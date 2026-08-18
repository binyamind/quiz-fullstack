import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './errors.ts';

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    })
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    const pgCode = (error as PostgresError).code;
    if (pgCode === PG_UNIQUE_VIOLATION) {
      return reply.code(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
          details: (error as PostgresError).constraint,
        },
      });
    }
    if (pgCode === PG_FOREIGN_KEY_VIOLATION) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Referenced resource does not exist',
        },
      });
    }
    if (pgCode === PG_CHECK_VIOLATION) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Value violates a database constraint',
        },
      });
    }

    // Fastify's own errors (bad JSON body, unsupported media type, ...)
    const fastifyError = error as {
      statusCode?: number;
      code?: string;
      message: string;
    };
    if (
      typeof fastifyError.statusCode === 'number' &&
      fastifyError.statusCode < 500
    ) {
      return reply.code(fastifyError.statusCode).send({
        error: {
          code: fastifyError.code ?? 'BAD_REQUEST',
          message: fastifyError.message,
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
}
