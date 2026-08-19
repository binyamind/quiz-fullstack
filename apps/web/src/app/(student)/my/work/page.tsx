import Link from 'next/link';
import { EmptyState } from '@/components/data/empty-state.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { StatusBadge } from '@/components/data/status-badge.tsx';
import { Card } from '@/components/ui/card.tsx';
import { dueState, formatDateTime } from '@/lib/format.ts';
import {
  listStudentAssignments,
  listStudentSubmissions,
} from '@/lib/queries.ts';
import { requireSession } from '@/lib/session.ts';

export default async function WorkListPage() {
  const user = await requireSession();
  const [assignments, submissions] = await Promise.all([
    listStudentAssignments(user.id, true),
    listStudentSubmissions(user.id),
  ]);
  const byAssignment = new Map(
    submissions.data.map((item) => [item.assignmentId, item])
  );

  return (
    <>
      <PageHeader
        kicker="Work"
        title="Assignments"
        description="Published briefs only. Drafts stay with your teacher."
      />
      {assignments.data.length === 0 ? (
        <EmptyState
          title="No published work"
          body="When a teacher publishes an assignment, it will land here."
        />
      ) : (
        <div className="space-y-3">
          {assignments.data.map((item) => {
            const submission = byAssignment.get(item.id);
            return (
              <Link key={item.id} href={`/my/work/${item.id}`}>
                <Card
                  stripe={
                    submission?.grade != null
                      ? 'marked'
                      : dueState(item.dueAt, true)
                  }
                  className="hover:border-binding"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-medium">{item.title}</h2>
                      <p className="mt-1 text-xs text-muted">
                        Due {formatDateTime(item.dueAt)}
                      </p>
                    </div>
                    <StatusBadge
                      published
                      dueAt={item.dueAt}
                      graded={submission?.grade != null}
                    />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
