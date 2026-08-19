'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiMutate, apiRequest, readPayload, errorFromPayload } from '@/lib/api.ts';
import { homeForRole } from '@/lib/auth.ts';
import { flattenZodIssues, ApiError } from '@/lib/errors.ts';
import { loginSchema } from '@/lib/schemas.ts';
import { applySetCookies } from '@/lib/session.ts';
import type { PublicUser } from '@/lib/types.ts';
import { type ActionState, field, fromApiError } from './result.ts';

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: field(formData, 'email'),
    password: field(formData, 'password'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: parsed.data,
    cookie: '',
  });
  await applySetCookies(response);
  const payload = await readPayload(response);
  if (!response.ok) {
    return fromApiError(errorFromPayload(response.status, payload));
  }

  const user = (payload as { user: PublicUser }).user;
  revalidatePath('/', 'layout');
  redirect(homeForRole(user.role));
}

export async function logoutAction(): Promise<void> {
  const response = await apiRequest('/auth/logout', { method: 'POST' });
  await applySetCookies(response);
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function sendChatAction(
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<{ reply: string } | { error: string }> {
  try {
    const result = await apiMutate<{ reply: string }>('/chat', {
      method: 'POST',
      body: { messages },
    });
    return { reply: result.reply };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    return { error: 'Chat is unavailable' };
  }
}
