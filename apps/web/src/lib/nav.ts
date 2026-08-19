import type { Role } from '@/lib/types.ts';

export interface NavItem {
  href: string;
  label: string;
}

export function navForRole(role: Role): NavItem[] {
  if (role === 'admin') {
    return [
      { href: '/admin', label: 'Overview' },
      { href: '/admin/users', label: 'People' },
      { href: '/admin/groups', label: 'Groups' },
      { href: '/teach', label: 'Classes' },
    ];
  }
  if (role === 'teacher') {
    return [
      { href: '/teach', label: 'Classes' },
    ];
  }
  return [
    { href: '/my', label: 'Home' },
    { href: '/my/work', label: 'Work' },
  ];
}
