'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navForRole } from '@/lib/nav.ts';
import { cn } from '@/lib/cn.ts';
import type { Role } from '@/lib/types.ts';

export function RoleNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="mt-8 flex flex-col gap-1">
      {navForRole(role).map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/admin' &&
            item.href !== '/teach' &&
            item.href !== '/my' &&
            pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm',
              active
                ? 'bg-binding-soft font-medium text-binding-dark'
                : 'text-muted hover:bg-white hover:text-ink'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
