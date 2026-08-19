'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api.ts';
import { flattenZodIssues } from '@/lib/errors.ts';
import { gradeSubmissionSchema, submitWorkSchema } from '@/lib/schemas.ts';
import type { Submission } from '@/lib/types.ts';
import { type ActionState, field, fromApiError } from './result.ts';

export async function submitWorkAction(
  assignmentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = submitWorkSchema.safeParse({
    content: field(formData, 'content'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    await apiMutate<Submission>(`/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      body: { content: parsed.data.content },
    });
    revalidatePath('/my/work');
    revalidatePath(`/my/work/${assignmentId}`);
    return { success: 'Submitted' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function updateWorkAction(
  submissionId: string,
  assignmentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = submitWorkSchema.safeParse({
    content: field(formData, 'content'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    await apiMutate(`/submissions/${submissionId}`, {
      method: 'PATCH',
      body: { content: parsed.data.content },
    });
    revalidatePath('/my/work');
    revalidatePath(`/my/work/${assignmentId}`);
    return { success: 'Updated' };
  } catch (error) {
    return fromApiError(error);
  }
}

export async function gradeSubmissionAction(
  submissionId: string,
  assignmentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = gradeSubmissionSchema.safeParse({
    grade: field(formData, 'grade'),
    feedback: field(formData, 'feedback'),
    maxGrade: field(formData, 'maxGrade'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodIssues(parsed.error.issues) };
  }

  try {
    await apiMutate(`/submissions/${submissionId}/grade`, {
      method: 'PATCH',
      body: {
        grade: parsed.data.grade,
        feedback: parsed.data.feedback || null,
      },
    });
    revalidatePath(`/teach/assignments/${assignmentId}`);
    revalidatePath(`/teach/submissions/${submissionId}`);
    revalidatePath(`/my/work/${assignmentId}`);
    return { success: 'Marked' };
  } catch (error) {
    return fromApiError(error);
  }
}
