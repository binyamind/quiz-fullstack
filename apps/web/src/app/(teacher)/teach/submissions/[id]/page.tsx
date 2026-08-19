import { GradeForm } from '@/components/forms/work-forms.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import { getAssignment, getSubmission, studentNames } from '@/lib/queries.ts';
import { formatDateTime } from '@/lib/format.ts';

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await getSubmission(id);
  const [assignment, students] = await Promise.all([
    getAssignment(submission.assignmentId),
    studentNames(),
  ]);
  const student = students.data.find((person) => person.id === submission.studentId);

  return (
    <>
      <PageHeader
        kicker={assignment.title}
        title={student?.name ?? 'Submission'}
        description={`Handed in ${formatDateTime(submission.submittedAt)}`}
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl">Work</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
            {submission.content}
          </p>
        </Card>
        <Card>
          <GradeForm submission={submission} maxGrade={assignment.maxGrade} />
        </Card>
      </div>
    </>
  );
}
