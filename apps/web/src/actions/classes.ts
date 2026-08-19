'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiMutate } from '@/lib/api.ts';
import { flattenZodIssues } from '@/lib/errors.ts';
import { createClassSchema } from '@/lib/schemas.ts';
import type { SchoolClass } from '@/lib/types.ts';
import { type ActionState, field, fromApiError } from './result.ts';

export async function createClassAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createClassSchema.safeParse({
    name: field(formData, 'name'),
    description: field(formData, 'description'),
    teacherId: field(formData, 'teacherId'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    const created = await apiMutate<SchoolClass>('/classes', {
      method: 'POST',
      body: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        teacherId: parsed.data.teacherId,
      },
    });
    revalidatePath('/teach');
    redirect(`/teach/classes/${created.id}`);
  } catch (error) {
    return fromApiError(error);
  }
}

export async function updateClassAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createClassSchema.pick({ name: true, description: true }).safeParse({
    name: field(formData, 'name'),
    description: field(formData, 'description'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    await apiMutate(`/classes/${id}`, {
      method: 'PATCH',
      body: {
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });
    revalidatePath('/teach');
    revalidatePath(`/teach/classes/${id}`);
    return { success: 'Saved' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function deleteClassAction(id: string): Promise<ActionState> {
  try {
    await apiMutate(`/classes/${id}`, { method: 'DELETE' });
    revalidatePath('/teach');
    redirect('/teach');
  } catch (error) {
    return fromApiError(error);
  }
}

export async function enrollStudentAction(
  classId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const studentId = field(formData, 'studentId');
  if (!studentId) return { error: 'Choose a student' };

  try {
    await apiMutate(`/classes/${classId}/students`, {
      method: 'POST',
      body: { studentId },
    });
    revalidatePath(`/teach/classes/${classId}`);
    return { success: 'Student enrolled' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function unenrollStudentAction(
  classId: string,
  studentId: string
): Promise<ActionState> {
  try {
    await apiMutate(`/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
    });
    revalidatePath(`/teach/classes/${classId}`);
    return { success: 'Student removed' };
  } catch (error) {
    return fromApiError(error);
  }
}
