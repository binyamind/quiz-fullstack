import { EditGroupForms } from '@/components/forms/group-forms.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import { getGroup, listUsers } from '@/lib/queries.ts';

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, teachers] = await Promise.all([
    getGroup(id),
    listUsers({ role: 'teacher', limit: 200 }),
  ]);

  return (
    <>
      <PageHeader kicker="Group" title={group.name} />
      <Card>
        <EditGroupForms group={group} teachers={teachers.data} />
      </Card>
    </>
  );
}
