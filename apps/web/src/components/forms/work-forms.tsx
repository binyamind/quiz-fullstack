'use client';

import { useActionState } from 'react';
import {
  gradeSubmissionAction,
  submitWorkAction,
  updateWorkAction,
} from '@/actions/submissions.ts';
import { Field, FormAlert } from '@/components/forms/field.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import type { Submission } from '@/lib/types.ts';

export function SubmitWorkForm({
  assignmentId,
  submission,
}: {
  assignmentId: string;
  submission?: Submission;
}) {
  const action = submission
    ? updateWorkAction.bind(null, submission.id, assignmentId)
    : submitWorkAction.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert error={state?.error} success={state?.success} />
      <Field
        label="Your work"
        htmlFor="content"
        error={state?.fieldErrors?.content}
      >
        <Textarea
          id="content"
          name="content"
          defaultValue={submission?.content ?? ''}
          rows={10}
          required
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending
          ? 'Saving…'
          : submission
            ? 'Update submission'
            : 'Hand in'}
      </Button>
    </form>
  );
}

export function GradeForm({
  submission,
  maxGrade,
}: {
  submission: Submission;
  maxGrade: number;
}) {
  const action = gradeSubmissionAction.bind(
    null,
    submission.id,
    submission.assignmentId
  );
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert error={state?.error} success={state?.success} />
      <input type="hidden" name="maxGrade" value={maxGrade} />
      <Field label="Mark" htmlFor="grade" error={state?.fieldErrors?.grade}>
        <Input
          id="grade"
          name="grade"
          type="number"
          min={0}
          max={maxGrade}
          step="0.5"
          defaultValue={submission.grade ?? ''}
          required
        />
      </Field>
      <Field label="Feedback" htmlFor="feedback">
        <Textarea
          id="feedback"
          name="feedback"
          defaultValue={submission.feedback ?? ''}
          rows={5}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save mark'}
      </Button>
    </form>
  );
}
