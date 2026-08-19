import { EditUserForms } from '@/components/forms/edit-user-forms.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import { getUser } from '@/lib/queries.ts';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser(id);

  return (
    <>
      <PageHeader
        kicker={user.role}
        title={user.name}
        description={user.email}
      />
      <Card>
        <EditUserForms user={user} />
      </Card>
    </>
  );
}
