import { Badge } from '@/components/ui/badge.tsx';
import { dueState } from '@/lib/format.ts';

export function StatusBadge({
  published,
  dueAt,
  graded,
}: {
  published?: boolean;
  dueAt?: string | null;
  graded?: boolean;
}) {
  if (graded) return <Badge tone="marked">Marked</Badge>;
  if (published === false) return <Badge tone="neutral">Draft</Badge>;
  if (published && dueAt !== undefined) {
    const state = dueState(dueAt, true);
    if (state === 'overdue') return <Badge tone="danger">Past due</Badge>;
    if (state === 'due') return <Badge tone="due">Due</Badge>;
    return <Badge tone="open">Open</Badge>;
  }
  if (published) return <Badge tone="open">Published</Badge>;
  return <Badge>Active</Badge>;
}
