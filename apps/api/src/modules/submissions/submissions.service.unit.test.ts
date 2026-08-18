import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../shared/errors.ts';
import { createSubmissionsService } from './submissions.service.ts';

/**
 * The integration suite covers submissions end to end. These tests reach the
 * two guards that only fire when a submission is deleted between the read and
 * the write — a race no single-threaded HTTP test can stage.
 */
const SUBMISSION = {
  id: 'sub-1',
  assignmentId: 'a-1',
  studentId: 's-1',
  content: 'my essay',
  grade: null,
  feedback: null,
};

function build(repoOverrides: Record<string, unknown> = {}) {
  const repo = {
    async findById() {
      return SUBMISSION;
    },
    async updateContent() {
      return { ...SUBMISSION, content: 'edited' };
    },
    async grade() {
      return { ...SUBMISSION, grade: 90 };
    },
    ...repoOverrides,
  };
  const assignments = {
    async requireAssignment() {
      return { id: 'a-1', maxGrade: 100 };
    },
  };
  return createSubmissionsService(
    repo as never,
    assignments as never,
    {} as never,
    {} as never
  );
}

describe('updateContent', () => {
  it('returns the updated submission', async () => {
    await expect(
      build().updateContent('sub-1', { content: 'edited' })
    ).resolves.toMatchObject({ content: 'edited' });
  });

  it('reports not found when the row vanishes mid-update', async () => {
    const service = build({ updateContent: vi.fn(async () => undefined) });

    await expect(
      service.updateContent('sub-1', { content: 'edited' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('grade', () => {
  it('returns the graded submission', async () => {
    await expect(build().grade('sub-1', { grade: 90 })).resolves.toMatchObject({
      grade: 90,
    });
  });

  it('reports not found when the row vanishes mid-grade', async () => {
    const service = build({ grade: vi.fn(async () => undefined) });

    await expect(service.grade('sub-1', { grade: 90 })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
