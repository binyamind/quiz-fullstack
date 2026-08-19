'use client';

import { useActionState } from 'react';
import {
  createAssignmentAction,
  deleteAssignmentAction,
  publishAssignmentAction,
  updateAssignmentAction,
} from '@/actions/assignments.ts';
import { toFormAction } from '@/actions/result.ts';
import { Field, FormAlert } from '@/components/forms/field.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import type { Assignment } from '@/lib/types.ts';

function toLocalInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateAssignmentForm({ classId }: { classId: string }) {
  const action = createAssignmentAction.bind(null, classId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert error={state?.error} />
      <Field label="Title" htmlFor="title" error={state?.fieldErrors?.title}>
        <Input id="title" name="title" required />
      </Field>
      <Field label="Brief" htmlFor="description">
        <Textarea id="description" name="description" rows={6} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due" htmlFor="dueAt">
          <Input id="dueAt" name="dueAt" type="datetime-local" />
        </Field>
        <Field
          label="Maximum mark"
          htmlFor="maxGrade"
          error={state?.fieldErrors?.maxGrade}
        >
          <Input
            id="maxGrade"
            name="maxGrade"
            type="number"
            defaultValue={100}
            min={1}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" value="true" />
        Publish immediately
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save assignment'}
      </Button>
    </form>
  );
}

export function EditAssignmentForms({ assignment }: { assignment: Assignment }) {
  const update = updateAssignmentAction.bind(
    null,
    assignment.id,
    assignment.classId
  );
  const [state, formAction, pending] = useActionState(update, null);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <FormAlert error={state?.error} success={state?.success} />
        <Field label="Title" htmlFor="title" error={state?.fieldErrors?.title}>
          <Input id="title" name="title" defaultValue={assignment.title} required />
        </Field>
        <Field label="Brief" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            defaultValue={assignment.description ?? ''}
            rows={6}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due" htmlFor="dueAt">
            <Input
              id="dueAt"
              name="dueAt"
              type="datetime-local"
              defaultValue={toLocalInput(assignment.dueAt)}
            />
          </Field>
          <Field label="Maximum mark" htmlFor="maxGrade">
            <Input
              id="maxGrade"
              name="maxGrade"
              type="number"
              defaultValue={assignment.maxGrade}
              min={1}
            />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save assignment'}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <form
          action={toFormAction(() =>
            publishAssignmentAction(
              assignment.id,
              assignment.classId,
              !assignment.published
            )
          )}
        >
          <Button type="submit" variant="secondary">
            {assignment.published ? 'Unpublish' : 'Publish'}
          </Button>
        </form>
        <form
          action={toFormAction(() =>
            deleteAssignmentAction(assignment.id, assignment.classId)
          )}
        >
          <Button type="submit" variant="danger">
            Delete assignment
          </Button>
        </form>
      </div>
    </div>
  );
}
