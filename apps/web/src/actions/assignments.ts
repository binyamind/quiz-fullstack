'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiMutate } from '@/lib/api.ts';
import { flattenZodIssues } from '@/lib/errors.ts';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from '@/lib/schemas.ts';
import type { Assignment } from '@/lib/types.ts';
import { type ActionState, field, fromApiError } from './result.ts';

function dueAtBody(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

export async function createAssignmentAction(
  classId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createAssignmentSchema.safeParse({
    title: field(formData, 'title'),
    description: field(formData, 'description'),
    dueAt: field(formData, 'dueAt'),
    maxGrade: field(formData, 'maxGrade'),
    published: field(formData, 'published') || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    const created = await apiMutate<Assignment>(
      `/classes/${classId}/assignments`,
      {
        method: 'POST',
        body: {
          title: parsed.data.title,
          description: parsed.data.description || null,
          dueAt: dueAtBody(parsed.data.dueAt),
          maxGrade: parsed.data.maxGrade,
          published: parsed.data.published === 'true',
        },
      }
    );
    revalidatePath(`/teach/classes/${classId}`);
    redirect(`/teach/assignments/${created.id}`);
  } catch (error) {
    return fromApiError(error);
  }
}

export async function updateAssignmentAction(
  id: string,
  classId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = updateAssignmentSchema.safeParse({
    title: field(formData, 'title'),
    description: field(formData, 'description'),
    dueAt: field(formData, 'dueAt'),
    maxGrade: field(formData, 'maxGrade'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    await apiMutate(`/assignments/${id}`, {
      method: 'PATCH',
      body: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        dueAt: dueAtBody(parsed.data.dueAt),
        maxGrade: parsed.data.maxGrade,
      },
    });
    revalidatePath(`/teach/classes/${classId}`);
    revalidatePath(`/teach/assignments/${id}`);
    return { success: 'Saved' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function publishAssignmentAction(
  id: string,
  classId: string,
  published: boolean
): Promise<ActionState> {
  try {
    await apiMutate(`/assignments/${id}/${published ? 'publish' : 'unpublish'}`, {
      method: 'POST',
    });
    revalidatePath(`/teach/classes/${classId}`);
    revalidatePath(`/teach/assignments/${id}`);
    revalidatePath('/my/work');
    return { success: published ? 'Published' : 'Unpublished' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function deleteAssignmentAction(
  id: string,
  classId: string
): Promise<ActionState> {
  try {
    await apiMutate(`/assignments/${id}`, { method: 'DELETE' });
    revalidatePath(`/teach/classes/${classId}`);
    redirect(`/teach/classes/${classId}`);
  } catch (error) {
    return fromApiError(error);
  }
}
