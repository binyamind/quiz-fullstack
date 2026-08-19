'use client';

import { useActionState } from 'react';
import {
  addGroupMemberAction,
  createGroupAction,
  deleteGroupAction,
  removeGroupMemberAction,
  updateGroupAction,
} from '@/actions/groups.ts';
import { toFormAction } from '@/actions/result.ts';
import { Field, FormAlert } from '@/components/forms/field.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import type { PublicUser, TeacherGroupDetail } from '@/lib/types.ts';

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroupAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormAlert error={state?.error} />
      <Field label="Name" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" required />
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        error={state?.fieldErrors?.description}
      >
        <Textarea id="description" name="description" rows={3} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create group'}
      </Button>
    </form>
  );
}

export function EditGroupForms({
  group,
  teachers,
}: {
  group: TeacherGroupDetail;
  teachers: PublicUser[];
}) {
  const update = updateGroupAction.bind(null, group.id);
  const add = addGroupMemberAction.bind(null, group.id);
  const [updateState, updateForm, updatePending] = useActionState(update, null);
  const [addState, addForm, addPending] = useActionState(add, null);
  const memberIds = new Set(group.members.map((member) => member.id));
  const available = teachers.filter((teacher) => !memberIds.has(teacher.id));

  return (
    <div className="space-y-8">
      <form action={updateForm} className="space-y-4">
        <FormAlert error={updateState?.error} success={updateState?.success} />
        <Field label="Name" htmlFor="name" error={updateState?.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={group.name} required />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            defaultValue={group.description ?? ''}
            rows={3}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={updatePending}>
            {updatePending ? 'Saving…' : 'Save group'}
          </Button>
        </div>
      </form>
      <form action={toFormAction(() => deleteGroupAction(group.id))}>
        <Button type="submit" variant="danger">
          Delete group
        </Button>
      </form>

      <form action={addForm} className="flex flex-wrap items-end gap-3">
        <FormAlert error={addState?.error} success={addState?.success} />
        <Field label="Add teacher" htmlFor="teacherId">
          <select
            id="teacherId"
            name="teacherId"
            className="h-10 rounded-md border border-line bg-white px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Choose a teacher
            </option>
            {available.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" variant="secondary" disabled={addPending || available.length === 0}>
          Add
        </Button>
      </form>

      <ul className="divide-y divide-line rounded-md border border-line bg-white">
        {group.members.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No teachers in this group yet.</li>
        ) : (
          group.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span>{member.name}</span>
              <form
                action={toFormAction(() =>
                  removeGroupMemberAction(group.id, member.id)
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
