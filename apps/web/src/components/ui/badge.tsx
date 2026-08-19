import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn.ts';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'open' | 'due' | 'danger' | 'marked';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide',
        tone === 'neutral' && 'bg-paper text-muted',
        tone === 'open' && 'bg-binding-soft text-binding-dark',
        tone === 'due' && 'bg-orange-100 text-bell-due',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'marked' && 'bg-sky-100 text-bell-marked',
        className
      )}
      {...props}
    />
  );
}
