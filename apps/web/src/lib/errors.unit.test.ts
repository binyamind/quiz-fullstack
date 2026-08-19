import { describe, expect, it } from 'vitest';
import { ApiError, fieldErrorsFromDetails, flattenZodIssues } from './errors.ts';

describe('ApiError', () => {
  it('stores status, code and details', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'bad', [{ path: 'n' }]);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([{ path: 'n' }]);
    expect(error.name).toBe('ApiError');
  });
});

describe('fieldErrorsFromDetails', () => {
  it('returns empty for non-arrays and skips malformed items', () => {
    expect(fieldErrorsFromDetails(undefined)).toEqual({});
    expect(fieldErrorsFromDetails('nope')).toEqual({});
    expect(
      fieldErrorsFromDetails([null, 1, { path: 2, message: 'x' }, { path: 'email', message: 'taken' }])
    ).toEqual({ email: 'taken' });
  });
});

describe('flattenZodIssues', () => {
  it('joins paths and uses _form when empty', () => {
    expect(
      flattenZodIssues([
        { path: ['email'], message: 'invalid' },
        { path: [], message: 'form' },
      ])
    ).toEqual({ email: 'invalid', _form: 'form' });
  });
});
