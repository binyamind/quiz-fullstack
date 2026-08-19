import Link from 'next/link';
import { CreateUserForm } from '@/components/forms/create-user-form.tsx';
import { EmptyState } from '@/components/data/empty-state.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Card } from '@/components/ui/card.tsx';
import { listUsers } from '@/lib/queries.ts';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    role?: string;
    suspended?: string;
  }>;
}) {
  const filters = await searchParams;
  const { data } = await listUsers(filters);

  return (
    <>
      <PageHeader
        kicker="People"
        title="Directory"
        description="Create accounts, change roles, and suspend teachers or students."
      />
      <Card className="mb-8">
        <h2 className="font-display text-xl">New person</h2>
        <div className="mt-4">
          <CreateUserForm />
        </div>
      </Card>
      <form className="mb-4 flex flex-wrap gap-3">
        <input
          name="search"
          defaultValue={filters.search}
          placeholder="Search name or email"
          className="h-10 rounded-md border border-line bg-white px-3 text-sm"
        />
        <select
          name="role"
          defaultValue={filters.role ?? ''}
          className="h-10 rounded-md border border-line bg-white px-3 text-sm"
        >
          <option value="">Any role</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        <select
          name="suspended"
          defaultValue={filters.suspended ?? ''}
          className="h-10 rounded-md border border-line bg-white px-3 text-sm"
        >
          <option value="">Any status</option>
          <option value="true">Suspended</option>
          <option value="false">Active</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-binding px-4 text-sm text-white"
        >
          Filter
        </button>
      </form>
      {data.length === 0 ? (
        <EmptyState
          title="No people match"
          body="Clear the filters or create a new account."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-binding-dark hover:underline"
                    >
                      {user.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3">
                    {user.suspended ? (
                      <Badge tone="danger">Suspended</Badge>
                    ) : (
                      <Badge tone="open">Active</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
