import Link from 'next/link';
import { CreateGroupForm } from '@/components/forms/group-forms.tsx';
import { EmptyState } from '@/components/data/empty-state.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import { listGroups } from '@/lib/queries.ts';

export default async function GroupsPage() {
  const { data } = await listGroups();

  return (
    <>
      <PageHeader
        kicker="Faculty"
        title="Teacher groups"
        description="Collect teachers into departments or year teams."
      />
      <Card className="mb-8">
        <h2 className="font-display text-xl">New group</h2>
        <div className="mt-4 max-w-lg">
          <CreateGroupForm />
        </div>
      </Card>
      {data.length === 0 ? (
        <EmptyState
          title="No groups yet"
          body="Create a group, then add teachers to it."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((group) => (
            <Link key={group.id} href={`/admin/groups/${group.id}`}>
              <Card className="h-full hover:border-binding">
                <h2 className="font-display text-xl">{group.name}</h2>
                <p className="mt-2 text-sm text-muted">
                  {group.description || 'No description'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
