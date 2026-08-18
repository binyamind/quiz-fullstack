import { z } from 'zod';
import { uuid } from '../../shared/validation.ts';

export const createSubmissionSchema = z.object({
  /**
   * Students never send this — it comes from their session. Staff may pass it to
   * submit on a student's behalf, which the route enforces.
   */
  studentId: uuid.optional(),
  content: z.string().min(1).max(50000),
});

export const updateSubmissionSchema = z.object({
  content: z.string().min(1).max(50000),
});

export const gradeSubmissionSchema = z.object({
  grade: z.number().min(0).max(1000),
  feedback: z.string().max(10000).trim().nullish(),
});

export const listSubmissionsQuerySchema = z.object({
  graded: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const assignmentIdParams = z.object({ assignmentId: uuid });
export const submissionIdParams = z.object({ id: uuid });
export const studentIdParams = z.object({ studentId: uuid });

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
