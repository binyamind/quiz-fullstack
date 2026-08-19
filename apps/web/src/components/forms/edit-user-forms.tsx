'use client';

import { useActionState } from 'react';
import {
  deleteUserAction,
  setPasswordAction,
  setSuspendedAction,
  updateUserAction,
} from '@/actions/users.ts';
import { toFormAction } from '@/actions/result.ts';
import { Field, FormAlert } from '@/components/forms/field.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import type { PublicUser } from '@/lib/types.ts';

export function EditUserForms({ user }: { user: PublicUser }) {
  const update = updateUserAction.bind(null, user.id);
  const password = setPasswordAction.bind(null, user.id);
  const [updateState, updateForm, updatePending] = useActionState(update, null);
  const [passwordState, passwordForm, passwordPending] = useActionState(
    password,
    null
  );

  return (
    <div className="space-y-8">
      <form action={updateForm} className="grid gap-4 sm:grid-cols-2">
        <FormAlert error={updateState?.error} success={updateState?.success} />
        <Field label="Name" htmlFor="name" error={updateState?.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={user.name} required />
        </Field>
        <Field
          label="Email"
          htmlFor="email"
          error={updateState?.fieldErrors?.email}
        >
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={user.email}
            required
          />
        </Field>
        <Field label="Role" htmlFor="role" error={updateState?.fieldErrors?.role}>
          <select
            id="role"
            name="role"
            defaultValue={user.role}
            className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
          >
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={updatePending}>
            {updatePending ? 'Saving…' : 'Save person'}
          </Button>
        </div>
      </form>

      <form action={passwordForm} className="flex max-w-md flex-col gap-3">
        <FormAlert
          error={passwordState?.error}
          success={passwordState?.success}
        />
        <Field
          label="New password"
          htmlFor="password"
          error={passwordState?.fieldErrors?.password}
        >
          <Input id="password" name="password" type="password" minLength={8} />
        </Field>
        <Button type="submit" variant="secondary" disabled={passwordPending}>
          {passwordPending ? 'Updating…' : 'Reset password'}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <form
          action={toFormAction(() =>
            setSuspendedAction(user.id, !user.suspended)
          )}
        >
          <Button type="submit" variant="secondary">
            {user.suspended ? 'Restore account' : 'Suspend account'}
          </Button>
        </form>
        <form action={toFormAction(() => deleteUserAction(user.id))}>
          <Button type="submit" variant="danger">
            Delete person
          </Button>
        </form>
      </div>
    </div>
  );
}
