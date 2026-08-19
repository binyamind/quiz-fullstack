import type { ReactNode } from 'react';

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-binding">
            {kicker}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
