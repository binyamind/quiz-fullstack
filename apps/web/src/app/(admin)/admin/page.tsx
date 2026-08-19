import Link from 'next/link';
import { PageHeader } from '@/components/data/page-header.tsx';
import { Card } from '@/components/ui/card.tsx';
import {
  classSummaries,
  schoolAverages,
  studentNames,
  teacherNames,
} from '@/lib/queries.ts';
import { formatGrade } from '@/lib/format.ts';

export default async function AdminHomePage() {
  const [averages, teachers, students, classes] = await Promise.all([
    schoolAverages(),
    teacherNames(),
    studentNames(),
    classSummaries(),
  ]);

  return (
    <>
      <PageHeader
        kicker="Hall office"
        title="School overview"
        description="Live roll of people, classes, and the school-wide mark."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            Average mark
          </p>
          <p className="mt-2 font-display text-3xl">
            {formatGrade(averages.averageGrade, 100)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {averages.gradedSubmissions} marked submissions
          </p>
        </Card>
        <Card>
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            Teachers
          </p>
          <p className="mt-2 font-display text-3xl">{teachers.data.length}</p>
        </Card>
        <Card>
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            Students
          </p>
          <p className="mt-2 font-display text-3xl">{students.data.length}</p>
        </Card>
        <Card>
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            Classes
          </p>
          <p className="mt-2 font-display text-3xl">{classes.data.length}</p>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Classes</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Average</th>
              </tr>
            </thead>
            <tbody>
              {classes.data.map((row) => {
                const avg = averages.perClass.find(
                  (item) => item.classId === row.id
                );
                return (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        className="text-binding-dark hover:underline"
                        href={`/teach/classes/${row.id}`}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.teacherName}</td>
                    <td className="px-4 py-3 font-mono">{row.studentCount}</td>
                    <td className="px-4 py-3 font-mono">
                      {avg?.averageGrade == null
                        ? '—'
                        : avg.averageGrade.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
