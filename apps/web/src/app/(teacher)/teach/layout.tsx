import { AppShell } from '@/components/shell/app-shell.tsx';
import { requireSession } from '@/lib/session.ts';
import type { ReactNode } from 'react';

export default async function TeachLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  return <AppShell user={user}>{children}</AppShell>;
}
