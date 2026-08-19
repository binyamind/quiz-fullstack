'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiMutate } from '@/lib/api.ts';
import { flattenZodIssues } from '@/lib/errors.ts';
import {
  createUserSchema,
  setPasswordFormSchema,
  updateUserSchema,
} from '@/lib/schemas.ts';
import type { PublicUser } from '@/lib/types.ts';
import { type ActionState, field, fromApiError } from './result.ts';

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === 'string' ? value : '';
  return text.length > 0 ? text : undefined;
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createUserSchema.safeParse({
    email: field(formData, 'email'),
    name: field(formData, 'name'),
    role: field(formData, 'role'),
    password: emptyToUndefined(formData.get('password')),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    const created = await apiMutate<PublicUser>('/users', {
      method: 'POST',
      body: {
        ...parsed.data,
        password: parsed.data.password || undefined,
      },
    });
    revalidatePath('/admin/users');
    redirect(`/admin/users/${created.id}`);
  } catch (error) {
    return fromApiError(error);
  }
}

export async function updateUserAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = updateUserSchema.safeParse({
    email: field(formData, 'email'),
    name: field(formData, 'name'),
    role: field(formData, 'role'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    await apiMutate(`/users/${id}`, { method: 'PATCH', body: parsed.data });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${id}`);
    return { success: 'Saved' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function setPasswordAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = setPasswordFormSchema.safeParse({
    password: field(formData, 'password'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    await apiMutate(`/users/${id}/password`, {
      method: 'PUT',
      body: parsed.data,
    });
    revalidatePath(`/admin/users/${id}`);
    return { success: 'Password updated' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function setSuspendedAction(
  id: string,
  suspended: boolean
): Promise<ActionState> {
  try {
    await apiMutate(`/users/${id}/${suspended ? 'suspend' : 'unsuspend'}`, {
      method: 'PATCH',
    });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${id}`);
    return { success: suspended ? 'Account suspended' : 'Account restored' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function deleteUserAction(id: string): Promise<ActionState> {
  try {
    await apiMutate(`/users/${id}`, { method: 'DELETE' });
    revalidatePath('/admin/users');
    redirect('/admin/users');
  } catch (error) {
    return fromApiError(error);
  }
}
