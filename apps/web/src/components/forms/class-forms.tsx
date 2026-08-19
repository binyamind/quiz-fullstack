'use client';

import { useActionState } from 'react';
import {
  createClassAction,
  deleteClassAction,
  enrollStudentAction,
  unenrollStudentAction,
  updateClassAction,
} from '@/actions/classes.ts';
import { toFormAction } from '@/actions/result.ts';
import { Field, FormAlert } from '@/components/forms/field.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import type { ClassDetail } from '@/lib/types.ts';

export function CreateClassForm({
  teacherId,
  teachers,
}: {
  teacherId?: string;
  teachers?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createClassAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormAlert error={state?.error} />
      {teacherId ? (
        <input type="hidden" name="teacherId" value={teacherId} />
      ) : (
        <Field
          label="Teacher"
          htmlFor="teacherId"
          error={state?.fieldErrors?.teacherId}
        >
          <select
            id="teacherId"
            name="teacherId"
            className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Choose a teacher
            </option>
            {(teachers ?? []).map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Class name" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" required />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Opening…' : 'Open class'}
      </Button>
    </form>
  );
}

export function ClassManageForms({
  schoolClass,
  students,
}: {
  schoolClass: ClassDetail;
  students: { id: string; name: string }[];
}) {
  const update = updateClassAction.bind(null, schoolClass.id);
  const enroll = enrollStudentAction.bind(null, schoolClass.id);
  const [updateState, updateForm, updatePending] = useActionState(update, null);
  const [enrollState, enrollForm, enrollPending] = useActionState(enroll, null);
  const enrolledIds = new Set(schoolClass.students.map((student) => student.id));
  const available = students.filter((student) => !enrolledIds.has(student.id));

  return (
    <div className="space-y-8">
      <form action={updateForm} className="space-y-4">
        <FormAlert error={updateState?.error} success={updateState?.success} />
        <Field label="Name" htmlFor="name" error={updateState?.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={schoolClass.name} required />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            defaultValue={schoolClass.description ?? ''}
            rows={3}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={updatePending}>
            {updatePending ? 'Saving…' : 'Save class'}
          </Button>
        </div>
      </form>
      <form action={toFormAction(() => deleteClassAction(schoolClass.id))}>
        <Button type="submit" variant="danger">
          Close class
        </Button>
      </form>

      <form action={enrollForm} className="flex flex-wrap items-end gap-3">
        <FormAlert error={enrollState?.error} success={enrollState?.success} />
        <Field label="Enrol student" htmlFor="studentId">
          <select
            id="studentId"
            name="studentId"
            className="h-10 rounded-md border border-line bg-white px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Choose a student
            </option>
            {available.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </Field>
        <Button
          type="submit"
          variant="secondary"
          disabled={enrollPending || available.length === 0}
        >
          Enrol
        </Button>
      </form>

      <ul className="divide-y divide-line rounded-md border border-line bg-white">
        {schoolClass.students.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">Roster is empty.</li>
        ) : (
          schoolClass.students.map((student) => (
            <li
              key={student.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span>{student.name}</span>
              <form
                action={toFormAction(() =>
                  unenrollStudentAction(schoolClass.id, student.id)
                )}
              >
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
