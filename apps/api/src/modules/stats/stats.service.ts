import { NotFoundError } from '../../shared/errors.ts';
import type { PublicUser } from '../../infra/schema.ts';
import type { Cache } from '../../shared/cache.ts';
import type { ClassesService } from '../classes/classes.service.ts';
import type { ClassAverage, StatsRepo } from './stats.repo.ts';

export interface StatsService {
  averageGrades(): Promise<{
    averageGrade: number | null;
    gradedSubmissions: number;
    perClass: ClassAverage[];
  }>;
  averageGradeForClass(classId: string): Promise<ClassAverage>;
  teacherNames(): Promise<{ id: string; name: string }[]>;
  studentNames(): Promise<{ id: string; name: string }[]>;
  classes(): Promise<
    { id: string; name: string; teacherName: string; studentCount: number }[]
  >;
  studentsInClass(classId: string): Promise<PublicUser[]>;
}

/** Every stats key shares this prefix so one call clears the whole namespace. */
export const STATS_CACHE_PREFIX = 'stats:';

export interface StatsCacheOptions {
  cache: Cache;
  ttlSeconds: number;
}

export function createStatsService(
  repo: StatsRepo,
  classes: ClassesService,
  { cache, ttlSeconds }: StatsCacheOptions
): StatsService {
  const cached = <T>(key: string, load: () => Promise<T>) =>
    cache.wrap(`${STATS_CACHE_PREFIX}${key}`, ttlSeconds, load);

  return {
    async averageGrades() {
      return cached('average-grades', async () => {
        const [overall, perClass] = await Promise.all([
          repo.overallAverageGrade(),
          repo.averagesPerClass(),
        ]);
        return { ...overall, perClass };
      });
    },

    async averageGradeForClass(classId) {
      // The miss path throws, so a missing class is never cached as a value.
      return cached(`average-grades:${classId}`, async () => {
        const row = await repo.averageGradeByClass(classId);
        if (!row) throw new NotFoundError('Class', classId);
        return row;
      });
    },

    async teacherNames() {
      return cached('teacher-names', () => repo.teacherNames());
    },

    async studentNames() {
      return cached('student-names', () => repo.studentNames());
    },

    async classes() {
      return cached('classes', () => repo.classSummaries());
    },

    async studentsInClass(classId) {
      return cached(`classes:${classId}:students`, () =>
        classes.listStudents(classId)
      );
    },
  };
}
