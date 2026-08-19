import { describe, expect, it, vi } from 'vitest';

vi.mock('./api.ts', () => ({
  apiFetch: vi.fn(async (path: string) => path),
}));

const { apiFetch } = await import('./api.ts');
const queries = await import('./queries.ts');

describe('queries', () => {
  it('builds each collection path', async () => {
    await queries.listUsers({ search: 'ada', role: 'admin', limit: 10 });
    await queries.getUser('u1');
    await queries.listGroups();
    await queries.getGroup('g1');
    await queries.listClasses({ teacherId: 't1' });
    await queries.getClass('c1');
    await queries.listClassAssignments('c1');
    await queries.listClassAssignments('c1', true);
    await queries.getAssignment('a1');
    await queries.listAssignmentSubmissions('a1');
    await queries.getSubmission('s1');
    await queries.listStudentClasses('st1');
    await queries.listStudentAssignments('st1');
    await queries.listStudentAssignments('st1', false);
    await queries.listStudentSubmissions('st1');
    await queries.schoolAverages();
    await queries.teacherNames();
    await queries.studentNames();
    await queries.classSummaries();

    const paths = vi.mocked(apiFetch).mock.calls.map((call) => call[0]);
    expect(paths).toContain('/users?search=ada&role=admin&limit=10');
    expect(paths).toContain('/classes/c1/assignments?published=true');
    expect(paths).toContain('/students/st1/assignments?published=false');
    expect(paths).toContain('/stats/average-grades');
  });
});
