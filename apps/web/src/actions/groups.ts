'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiMutate } from '@/lib/api.ts';
import { flattenZodIssues } from '@/lib/errors.ts';
import { createGroupSchema } from '@/lib/schemas.ts';
import type { TeacherGroup } from '@/lib/types.ts';
import { type ActionState, field, fromApiError } from './result.ts';

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createGroupSchema.safeParse({
    name: field(formData, 'name'),
    description: field(formData, 'description'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    const created = await apiMutate<TeacherGroup>('/teacher-groups', {
      method: 'POST',
      body: {
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });
    revalidatePath('/admin/groups');
    redirect(`/admin/groups/${created.id}`);
  } catch (error) {
    return fromApiError(error);
  }
}

export async function updateGroupAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createGroupSchema.safeParse({
    name: field(formData, 'name'),
    description: field(formData, 'description'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    await apiMutate(`/teacher-groups/${id}`, {
      method: 'PATCH',
      body: {
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });
    revalidatePath('/admin/groups');
    revalidatePath(`/admin/groups/${id}`);
    return { success: 'Saved' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function deleteGroupAction(id: string): Promise<ActionState> {
  try {
    await apiMutate(`/teacher-groups/${id}`, { method: 'DELETE' });
    revalidatePath('/admin/groups');
    redirect('/admin/groups');
  } catch (error) {
    return fromApiError(error);
  }
}

export async function addGroupMemberAction(
  groupId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const teacherId = field(formData, 'teacherId');
  if (!teacherId) return { error: 'Choose a teacher' };

  try {
    await apiMutate(`/teacher-groups/${groupId}/members`, {
      method: 'POST',
      body: { teacherId },
    });
    revalidatePath(`/admin/groups/${groupId}`);
    return { success: 'Teacher added' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function removeGroupMemberAction(
  groupId: string,
  teacherId: string
): Promise<ActionState> {
  try {
    await apiMutate(`/teacher-groups/${groupId}/members/${teacherId}`, {
      method: 'DELETE',
    });
    revalidatePath(`/admin/groups/${groupId}`);
    return { success: 'Teacher removed' };
  } catch (error) {
    return fromApiError(error);
  }
}
