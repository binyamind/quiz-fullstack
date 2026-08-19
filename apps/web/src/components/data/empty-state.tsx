import Link from 'next/link';
import { cn } from '@/lib/cn.ts';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className={cn(
            'mt-4 inline-flex h-10 items-center rounded-md bg-binding px-4 text-sm text-white hover:bg-binding-dark'
          )}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
