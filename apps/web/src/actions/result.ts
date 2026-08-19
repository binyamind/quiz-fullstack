import { ApiError, fieldErrorsFromDetails } from '@/lib/errors.ts';

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
} | null;

export function isNextSignal(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (!('digest' in error)) return false;
  const digest = error.digest;
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND'))
  );
}

export function fromApiError(error: unknown): ActionState {
  if (isNextSignal(error)) throw error;
  if (error instanceof ApiError) {
    return {
      error: error.message,
      fieldErrors: fieldErrorsFromDetails(error.details),
    };
  }
  return { error: 'Something went wrong' };
}

export function toFormAction(
  run: () => Promise<unknown>
): (formData: FormData) => Promise<void> {
  return async () => {
    await run();
  };
}

export function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}
