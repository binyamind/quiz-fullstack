import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { registerErrorHandler } from './error-handler.ts';
import { AppError, NotFoundError } from './errors.ts';

interface PgErrorShape {
  code: string;
  constraint?: string;
}

/** A Fastify app whose only route rethrows whatever the test hands it. */
async function appThrowing(error: unknown): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  app.get('/boom', async () => {
    throw error;
  });
  app.post('/echo', async (request) => request.body);
  await app.ready();
  return app;
}

function pgError(shape: PgErrorShape): Error {
  return Object.assign(new Error('database rejected the statement'), shape);
}

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('error handler', () => {
  it('turns a ZodError into a 400 with per-field details', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const error = (() => {
      try {
        schema.parse({ age: 'old' });
      } catch (e) {
        return e;
      }
    })();
    app = await appThrowing(error);

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
    });
    expect(response.json().error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'age' }),
      ])
    );
  });

  it('renders an AppError with its own status, code and details', async () => {
    app = await appThrowing(
      new AppError(418, 'TEAPOT', 'I am a teapot', { hint: 'brew tea' })
    );

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(418);
    expect(response.json()).toEqual({
      error: {
        code: 'TEAPOT',
        message: 'I am a teapot',
        details: { hint: 'brew tea' },
      },
    });
  });

  it('renders an AppError subclass that carries no details', async () => {
    app = await appThrowing(new NotFoundError('Class', 'abc'));

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'NOT_FOUND',
      message: "Class 'abc' not found",
    });
  });

  it('maps a unique violation to 409 with the constraint name', async () => {
    app = await appThrowing(
      pgError({ code: '23505', constraint: 'users_email_key' })
    );

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toEqual({
      code: 'CONFLICT',
      message: 'Resource already exists',
      details: 'users_email_key',
    });
  });

  it('maps a foreign key violation to 400', async () => {
    app = await appThrowing(pgError({ code: '23503' }));

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_REFERENCE');
  });

  it('maps a check violation to 400', async () => {
    app = await appThrowing(pgError({ code: '23514' }));

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Value violates a database constraint',
    });
  });

  it("passes through Fastify's own 4xx errors", async () => {
    app = await appThrowing(
      Object.assign(new Error('Unsupported Media Type'), {
        statusCode: 415,
        code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE',
      })
    );

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(415);
    expect(response.json().error).toEqual({
      code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE',
      message: 'Unsupported Media Type',
    });
  });

  it('falls back to BAD_REQUEST when a 4xx error carries no code', async () => {
    app = await appThrowing(
      Object.assign(new Error('missing something'), { statusCode: 422 })
    );

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('BAD_REQUEST');
  });

  it('hides an unexpected error behind a logged 500', async () => {
    app = await appThrowing(new Error('connection string leaked in here'));
    const log = vi.spyOn(app.log, 'error').mockImplementation(() => app!.log);

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(response.body).not.toContain('connection string');
    expect(log).toHaveBeenCalled();
  });

  it('treats a 5xx statusCode as unexpected rather than passing it through', async () => {
    app = await appThrowing(
      Object.assign(new Error('upstream exploded'), { statusCode: 503 })
    );
    vi.spyOn(app.log, 'error').mockImplementation(() => app!.log);

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('INTERNAL_ERROR');
  });

  it('answers an unknown route with a 404 naming the method and url', async () => {
    app = await appThrowing(new Error('unused'));

    const response = await app.inject({ method: 'GET', url: '/nowhere' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toEqual({
      code: 'NOT_FOUND',
      message: 'Route GET /nowhere not found',
    });
  });
});
