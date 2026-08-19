import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChatPanel } from '@/components/chat/chat-panel.tsx';
import { RoleNav } from '@/components/shell/role-nav.tsx';
import { UserMenu } from '@/components/shell/user-menu.tsx';
import type { PublicUser } from '@/lib/types.ts';

export function AppShell({
  user,
  children,
}: {
  user: PublicUser;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-white px-5 py-6 lg:border-b-0 lg:border-r">
        <Link href="/" className="block">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-binding">
            School hall
          </p>
          <p className="font-display text-2xl leading-none">The Register</p>
        </Link>
        <RoleNav role={user.role} />
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-line bg-white/80 px-4 py-3 backdrop-blur">
          <ChatPanel />
          <UserMenu user={user} />
        </header>
        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
