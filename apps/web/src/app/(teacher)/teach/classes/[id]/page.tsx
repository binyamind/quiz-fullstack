import Link from 'next/link';
import { ClassManageForms } from '@/components/forms/class-forms.tsx';
import { StatusBadge } from '@/components/data/status-badge.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import {
  getClass,
  listClassAssignments,
  studentNames,
} from '@/lib/queries.ts';
import { dueState, formatDateTime } from '@/lib/format.ts';

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [schoolClass, assignments, students] = await Promise.all([
    getClass(id),
    listClassAssignments(id),
    studentNames(),
  ]);

  return (
    <>
      <PageHeader
        kicker={schoolClass.teacher.name}
        title={schoolClass.name}
        description={schoolClass.description ?? undefined}
        actions={
          <Button asChild>
            <Link href={`/teach/classes/${id}/assignments/new`}>
              New assignment
            </Link>
          </Button>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="font-display text-2xl">Assignments</h2>
          <div className="mt-4 space-y-3">
            {assignments.data.length === 0 ? (
              <p className="text-sm text-muted">No assignments yet.</p>
            ) : (
              assignments.data.map((item) => (
                <Link key={item.id} href={`/teach/assignments/${item.id}`}>
                  <Card
                    stripe={
                      item.published
                        ? dueState(item.dueAt, true) === 'overdue'
                          ? 'overdue'
                          : 'due'
                        : 'draft'
                    }
                    className="hover:border-binding"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="mt-1 text-xs text-muted">
                          Due {formatDateTime(item.dueAt)}
                        </p>
                      </div>
                      <StatusBadge
                        published={item.published}
                        dueAt={item.dueAt}
                      />
                    </div>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </section>
        <Card>
          <h2 className="font-display text-xl">Roster</h2>
          <div className="mt-4">
            <ClassManageForms
              schoolClass={schoolClass}
              students={students.data}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
