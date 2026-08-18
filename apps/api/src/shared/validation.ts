import { z } from 'zod';

/** Parses with Zod and lets ZodError bubble to the central error handler. */
export function parse<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown
): z.infer<T> {
  return schema.parse(value);
}

export const uuid = z.string().uuid('must be a valid uuid');

export const idParams = z.object({ id: uuid });

export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListQuery = z.infer<typeof listQuery>;
