import type { FieldIssue } from './types.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function fieldErrorsFromDetails(
  details: unknown
): Record<string, string> {
  if (!Array.isArray(details)) return {};
  const fields: Record<string, string> = {};
  for (const item of details) {
    if (!item || typeof item !== 'object') continue;
    const issue = item as FieldIssue;
    if (typeof issue.path === 'string' && typeof issue.message === 'string') {
      fields[issue.path] = issue.message;
    }
  }
  return fields;
}

export function flattenZodIssues(
  issues: { path: (string | number)[]; message: string }[]
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_form';
    fields[key] = issue.message;
  }
  return fields;
}
