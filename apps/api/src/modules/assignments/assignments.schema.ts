import { z } from 'zod';
import { uuid } from '../../shared/validation.ts';

export const createAssignmentSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  description: z.string().max(10000).trim().nullish(),
  dueAt: z.coerce.date().nullish(),
  maxGrade: z.number().positive().max(1000).default(100),
  published: z.boolean().default(false),
});

export const updateAssignmentSchema = z
  .object({
    title: z.string().min(1).max(300).trim(),
    description: z.string().max(10000).trim().nullable(),
    dueAt: z.coerce.date().nullable(),
    maxGrade: z.number().positive().max(1000),
    published: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one field is required',
  });

export const listAssignmentsQuerySchema = z.object({
  published: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const classIdParams = z.object({ classId: uuid });
export const assignmentIdParams = z.object({ id: uuid });
export const studentIdParams = z.object({ studentId: uuid });

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
