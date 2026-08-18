import type { DB } from '../../infra/db.ts';

export interface ClassAverage {
  classId: string;
  className: string;
  averageGrade: number | null;
  gradedSubmissions: number;
}

export interface StatsRepo {
  overallAverageGrade(): Promise<{
    averageGrade: number | null;
    gradedSubmissions: number;
  }>;
  averageGradeByClass(classId: string): Promise<ClassAverage | undefined>;
  averagesPerClass(): Promise<ClassAverage[]>;
  teacherNames(): Promise<{ id: string; name: string }[]>;
  studentNames(): Promise<{ id: string; name: string }[]>;
  classSummaries(): Promise<
    { id: string; name: string; teacherName: string; studentCount: number }[]
  >;
}

export function createStatsRepo(db: DB): StatsRepo {
  return {
    async overallAverageGrade() {
      const row = await db
        .selectFrom('submissions')
        .select((eb) => [
          eb.fn.avg<number | null>('grade').as('averageGrade'),
          eb.fn.countAll<string>().as('count'),
        ])
        .where('grade', 'is not', null)
        // An aggregate without GROUP BY always yields exactly one row.
        .executeTakeFirstOrThrow();
      return {
        averageGrade:
          row.averageGrade === null ? null : Number(row.averageGrade),
        gradedSubmissions: Number(row.count),
      };
    },

    async averageGradeByClass(classId) {
      const row = await db
        .selectFrom('classes')
        .leftJoin('assignments', 'assignments.classId', 'classes.id')
        .leftJoin('submissions', (join) =>
          join
            .onRef('submissions.assignmentId', '=', 'assignments.id')
            .on('submissions.grade', 'is not', null)
        )
        .select((eb) => [
          'classes.id as classId',
          'classes.name as className',
          eb.fn.avg<number | null>('submissions.grade').as('averageGrade'),
          eb.fn.count<string>('submissions.id').as('count'),
        ])
        .where('classes.id', '=', classId)
        .groupBy(['classes.id', 'classes.name'])
        .executeTakeFirst();

      if (!row) return undefined;
      return {
        classId: row.classId,
        className: row.className,
        averageGrade:
          row.averageGrade === null ? null : Number(row.averageGrade),
        gradedSubmissions: Number(row.count),
      };
    },

    async averagesPerClass() {
      const rows = await db
        .selectFrom('classes')
        .leftJoin('assignments', 'assignments.classId', 'classes.id')
        .leftJoin('submissions', (join) =>
          join
            .onRef('submissions.assignmentId', '=', 'assignments.id')
            .on('submissions.grade', 'is not', null)
        )
        .select((eb) => [
          'classes.id as classId',
          'classes.name as className',
          eb.fn.avg<number | null>('submissions.grade').as('averageGrade'),
          eb.fn.count<string>('submissions.id').as('count'),
        ])
        .groupBy(['classes.id', 'classes.name'])
        .orderBy('classes.name', 'asc')
        .execute();

      return rows.map((row) => ({
        classId: row.classId,
        className: row.className,
        averageGrade:
          row.averageGrade === null ? null : Number(row.averageGrade),
        gradedSubmissions: Number(row.count),
      }));
    },

    async teacherNames() {
      return db
        .selectFrom('users')
        .select(['id', 'name'])
        .where('role', '=', 'teacher')
        .orderBy('name', 'asc')
        .execute();
    },

    async studentNames() {
      return db
        .selectFrom('users')
        .select(['id', 'name'])
        .where('role', '=', 'student')
        .orderBy('name', 'asc')
        .execute();
    },

    async classSummaries() {
      const rows = await db
        .selectFrom('classes')
        .innerJoin('users as teacher', 'teacher.id', 'classes.teacherId')
        .leftJoin('enrollments', 'enrollments.classId', 'classes.id')
        .select((eb) => [
          'classes.id as id',
          'classes.name as name',
          'teacher.name as teacherName',
          eb.fn.count<string>('enrollments.studentId').as('studentCount'),
        ])
        .groupBy(['classes.id', 'classes.name', 'teacher.name'])
        .orderBy('classes.name', 'asc')
        .execute();

      return rows.map((row) => ({
        ...row,
        studentCount: Number(row.studentCount),
      }));
    },
  };
}
