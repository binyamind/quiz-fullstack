import { z } from 'zod';
import { uuid } from '../../shared/validation.ts';

export const roleSchema = z.enum(['admin', 'teacher', 'student']);

export const passwordSchema = z.string().min(8).max(200);

export const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(200).trim(),
  role: roleSchema,
  /** Optional: an account may exist for OAuth-only sign-in. */
  password: passwordSchema.optional(),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one field is required',
  });

export const setPasswordSchema = z.object({ password: passwordSchema });

export const listUsersQuerySchema = z.object({
  role: roleSchema.optional(),
  suspended: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const userIdParams = z.object({ id: uuid });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
