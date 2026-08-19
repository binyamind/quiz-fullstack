import { CreateAssignmentForm } from '@/components/forms/assignment-forms.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import { getClass } from '@/lib/queries.ts';

export default async function NewAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schoolClass = await getClass(id);

  return (
    <>
      <PageHeader
        kicker={schoolClass.name}
        title="New assignment"
        description="Write the brief, set a due date, then publish when the class is ready."
      />
      <Card className="max-w-2xl">
        <CreateAssignmentForm classId={id} />
      </Card>
    </>
  );
}
