'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { logoutAction } from '@/actions/auth.ts';
import type { PublicUser } from '@/lib/types.ts';

export function UserMenu({ user }: { user: PublicUser }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm hover:border-binding focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-binding"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-binding-soft font-mono text-xs text-binding-dark">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden sm:inline">{user.name}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-48 rounded-md border border-line bg-white p-2 shadow-card"
        >
          <p className="px-2 py-1 text-xs text-muted">{user.email}</p>
          <p className="px-2 pb-2 font-mono text-[11px] uppercase tracking-wide text-binding">
            {user.role}
          </p>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-paper"
            onSelect={() => {
              void logoutAction();
            }}
          >
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
