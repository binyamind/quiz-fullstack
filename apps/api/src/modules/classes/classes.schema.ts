import { z } from 'zod';
import { uuid } from '../../shared/validation.ts';

export const createClassSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().nullish(),
  teacherId: uuid,
  studentIds: z.array(uuid).optional(),
});

export const updateClassSchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    description: z.string().max(2000).trim().nullable(),
    teacherId: uuid,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one field is required',
  });

export const listClassesQuerySchema = z.object({
  teacherId: uuid.optional(),
  studentId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const enrollStudentSchema = z.object({ studentId: uuid });

export const classIdParams = z.object({ id: uuid });
export const classStudentParams = z.object({ id: uuid, studentId: uuid });

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
