'use client';

import { useActionState } from 'react';
import { loginAction } from '@/actions/auth.ts';
import { FormAlert, Field } from '@/components/forms/field.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
      <FormAlert error={state?.error} />
      <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={state?.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
