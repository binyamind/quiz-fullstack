'use client';

import { useActionState } from 'react';
import { createUserAction } from '@/actions/users.ts';
import { Field, FormAlert } from '@/components/forms/field.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, null);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <FormAlert error={state?.error} />
      <Field label="Name" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" required />
      </Field>
      <Field label="Role" htmlFor="role" error={state?.fieldErrors?.role}>
        <select
          id="role"
          name="role"
          className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
          defaultValue="teacher"
        >
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="Optional for OAuth-only accounts"
        error={state?.fieldErrors?.password}
      >
        <Input id="password" name="password" type="password" minLength={8} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create person'}
        </Button>
      </div>
    </form>
  );
}
