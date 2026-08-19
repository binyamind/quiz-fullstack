import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn.ts';

export function Card({
  className,
  stripe,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  stripe?: 'draft' | 'open' | 'due' | 'overdue' | 'marked';
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-line bg-surface p-5 shadow-card',
        stripe && 'pl-6',
        className
      )}
      {...props}
    >
      {stripe ? (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-3 left-2 w-1 rounded-full',
            stripe === 'draft' && 'bg-bell-draft',
            stripe === 'open' && 'bg-bell-open',
            stripe === 'due' && 'bg-bell-due',
            stripe === 'overdue' && 'bg-danger',
            stripe === 'marked' && 'bg-bell-marked'
          )}
        />
      ) : null}
      {children}
    </div>
  );
}
