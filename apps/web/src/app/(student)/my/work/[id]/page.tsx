import { SubmitWorkForm } from '@/components/forms/work-forms.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import { formatDateTime, formatGrade } from '@/lib/format.ts';
import { getAssignment, listStudentSubmissions } from '@/lib/queries.ts';
import { requireSession } from '@/lib/session.ts';

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const { id } = await params;
  const [assignment, submissions] = await Promise.all([
    getAssignment(id),
    listStudentSubmissions(user.id),
  ]);
  const submission = submissions.data.find((item) => item.assignmentId === id);

  return (
    <>
      <PageHeader
        kicker="Brief"
        title={assignment.title}
        description={`Due ${formatDateTime(assignment.dueAt)} · ${assignment.maxGrade} marks`}
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <Card stripe="open">
          <h2 className="font-display text-xl">The brief</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
            {assignment.description || 'No extra notes.'}
          </p>
          {submission?.grade != null ? (
            <div className="mt-6 rounded-md bg-mark-soft px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-wide text-mark">
                Mark
              </p>
              <p className="mt-1 font-display text-2xl">
                {formatGrade(submission.grade, assignment.maxGrade)}
              </p>
              {submission.feedback ? (
                <p className="mt-2 text-sm">{submission.feedback}</p>
              ) : null}
            </div>
          ) : null}
        </Card>
        <Card>
          <SubmitWorkForm assignmentId={id} submission={submission} />
        </Card>
      </div>
    </>
  );
}
