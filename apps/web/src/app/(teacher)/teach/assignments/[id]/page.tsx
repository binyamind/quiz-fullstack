import Link from 'next/link';
import { EditAssignmentForms } from '@/components/forms/assignment-forms.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { StatusBadge } from '@/components/data/status-badge.tsx';
import { Card } from '@/components/ui/card.tsx';
import {
  getAssignment,
  listAssignmentSubmissions,
  studentNames,
} from '@/lib/queries.ts';
import { formatDateTime, formatGrade } from '@/lib/format.ts';

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [assignment, submissions, students] = await Promise.all([
    getAssignment(id),
    listAssignmentSubmissions(id),
    studentNames(),
  ]);
  const names = new Map(students.data.map((person) => [person.id, person.name]));

  return (
    <>
      <PageHeader
        kicker="Assignment"
        title={assignment.title}
        description={`Due ${formatDateTime(assignment.dueAt)}`}
        actions={<StatusBadge published={assignment.published} dueAt={assignment.dueAt} />}
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <EditAssignmentForms assignment={assignment} />
        </Card>
        <Card>
          <h2 className="font-display text-xl">Submissions</h2>
          <ul className="mt-4 divide-y divide-line">
            {submissions.data.length === 0 ? (
              <li className="py-3 text-sm text-muted">Nothing handed in yet.</li>
            ) : (
              submissions.data.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-3 text-sm">
                  <Link
                    href={`/teach/submissions/${item.id}`}
                    className="text-binding-dark hover:underline"
                  >
                    {names.get(item.studentId) ?? item.studentId}
                  </Link>
                  <span className="font-mono text-xs">
                    {formatGrade(item.grade, assignment.maxGrade)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
