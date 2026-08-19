import type { ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;
  return (
    <p
      role="status"
      className={cn(
        'rounded-md px-3 py-2 text-sm',
        error ? 'bg-danger-soft text-danger' : 'bg-mark-soft text-mark'
      )}
    >
      {error ?? success}
    </p>
  );
}
