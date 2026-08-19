import Link from 'next/link';
import { EmptyState } from '@/components/data/empty-state.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import { dueState, formatDateTime } from '@/lib/format.ts';
import {
  listStudentAssignments,
  listStudentClasses,
} from '@/lib/queries.ts';
import { requireSession } from '@/lib/session.ts';

export default async function StudentHomePage() {
  const user = await requireSession();
  const [classes, assignments] = await Promise.all([
    listStudentClasses(user.id),
    listStudentAssignments(user.id, true),
  ]);

  const upcoming = assignments.data
    .filter((item) => dueState(item.dueAt, true) !== 'overdue')
    .slice(0, 5);

  return (
    <>
      <PageHeader
        kicker="Student hall"
        title={`Hello, ${user.name.split(' ')[0]}`}
        description="Your classes and what is coming due."
      />
      <section>
        <h2 className="font-display text-2xl">Classes</h2>
        {classes.data.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="You are not enrolled yet"
              body="When a teacher adds you to a class, it will appear here."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {classes.data.map((item) => (
              <Card key={item.id}>
                <h3 className="font-display text-xl">{item.name}</h3>
                <p className="mt-2 text-sm text-muted">
                  {item.description || 'No description'}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl">Coming due</h2>
        <ul className="mt-4 space-y-3">
          {upcoming.length === 0 ? (
            <li className="text-sm text-muted">Nothing on the horizon.</li>
          ) : (
            upcoming.map((item) => (
              <li key={item.id}>
                <Link href={`/my/work/${item.id}`}>
                  <Card stripe="due" className="hover:border-binding">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.title}</span>
                      <span className="font-mono text-xs text-muted">
                        {formatDateTime(item.dueAt)}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  );
}
