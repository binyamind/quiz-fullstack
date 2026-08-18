import { z } from 'zod';
import { uuid } from '../../shared/validation.ts';

export const createTeacherGroupSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().nullish(),
  teacherIds: z.array(uuid).optional(),
});

export const updateTeacherGroupSchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    description: z.string().max(2000).trim().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one field is required',
  });

export const addMemberSchema = z.object({ teacherId: uuid });

export const groupIdParams = z.object({ id: uuid });
export const memberParams = z.object({ id: uuid, teacherId: uuid });

export type CreateTeacherGroupInput = z.infer<typeof createTeacherGroupSchema>;
export type UpdateTeacherGroupInput = z.infer<typeof updateTeacherGroupSchema>;
