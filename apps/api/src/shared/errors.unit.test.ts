import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors.ts';

describe('AppError', () => {
  it('carries its status, code, message and details', () => {
    const error = new AppError(418, 'TEAPOT', 'I am a teapot', { hint: 'tea' });

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('TEAPOT');
    expect(error.message).toBe('I am a teapot');
    expect(error.details).toEqual({ hint: 'tea' });
  });

  it('leaves details undefined when none are given', () => {
    expect(new AppError(400, 'BAD', 'bad').details).toBeUndefined();
  });
});

describe('NotFoundError', () => {
  it('names the resource and its id', () => {
    const error = new NotFoundError('Class', 'c-1');

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe("Class 'c-1' not found");
  });

  it('names just the resource when no id is given', () => {
    expect(new NotFoundError('Class').message).toBe('Class not found');
  });
});

describe('the remaining error types', () => {
  it('map to their HTTP statuses', () => {
    expect(new ValidationError('bad input').statusCode).toBe(400);
    expect(new UnauthorizedError('nope').statusCode).toBe(401);
    expect(new ForbiddenError('nope').statusCode).toBe(403);
    expect(new ConflictError('taken').statusCode).toBe(409);
  });

  it('passes details through where the constructor accepts them', () => {
    expect(new ConflictError('taken', { field: 'email' }).details).toEqual({
      field: 'email',
    });
    expect(new ValidationError('bad', { field: 'email' }).details).toEqual({
      field: 'email',
    });
  });
});
