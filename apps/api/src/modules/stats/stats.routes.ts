import type { FastifyPluginAsync } from 'fastify';
import { idParams, parse } from '../../shared/validation.ts';
import type { StatsService } from './stats.service.ts';

/** Mounted at /api/v0/stats — the six endpoints named in SPECS.md. */
export function statsRoutes(stats: StatsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/average-grades', async () => stats.averageGrades());

    app.get('/average-grades/:id', async (request) => {
      const { id } = parse(idParams, request.params);
      return stats.averageGradeForClass(id);
    });

    app.get('/teacher-names', async () => ({
      data: await stats.teacherNames(),
    }));

    app.get('/student-names', async () => ({
      data: await stats.studentNames(),
    }));

    app.get('/classes', async () => ({ data: await stats.classes() }));

    app.get('/classes/:id', async (request) => {
      const { id } = parse(idParams, request.params);
      return { data: await stats.studentsInClass(id) };
    });
  };
}
