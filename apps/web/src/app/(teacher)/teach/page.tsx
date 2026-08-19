import Link from 'next/link';
import { CreateClassForm } from '@/components/forms/class-forms.tsx';
import { EmptyState } from '@/components/data/empty-state.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import { listClasses, teacherNames } from '@/lib/queries.ts';
import { requireSession } from '@/lib/session.ts';

export default async function TeachHomePage() {
  const user = await requireSession();
  const [classes, teachers] = await Promise.all([
    listClasses(user.role === 'admin' ? {} : { teacherId: user.id }),
    user.role === 'admin' ? teacherNames() : Promise.resolve({ data: [] }),
  ]);
  const { data } = classes;

  return (
    <>
      <PageHeader
        kicker="Teaching"
        title="Your classes"
        description="Open a class, manage the roster, and publish work."
      />
      <Card className="mb-8 max-w-lg">
        <h2 className="font-display text-xl">Open a class</h2>
        <div className="mt-4">
          <CreateClassForm
            teacherId={user.role === 'teacher' ? user.id : undefined}
            teachers={teachers.data}
          />
        </div>
      </Card>
      {data.length === 0 ? (
        <EmptyState
          title="No classes yet"
          body="Open a class to start enrolling students."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((item) => (
            <Link key={item.id} href={`/teach/classes/${item.id}`}>
              <Card className="h-full hover:border-binding">
                <h2 className="font-display text-2xl">{item.name}</h2>
                <p className="mt-2 text-sm text-muted">
                  {item.description || 'No description'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
