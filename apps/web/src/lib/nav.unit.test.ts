import { describe, expect, it } from 'vitest';
import { navForRole } from './nav.ts';

describe('navForRole', () => {
  it('returns role-specific items', () => {
    expect(navForRole('admin').map((item) => item.href)).toContain('/admin/users');
    expect(navForRole('teacher')).toEqual([{ href: '/teach', label: 'Classes' }]);
    expect(navForRole('student').map((item) => item.href)).toEqual([
      '/my',
      '/my/work',
    ]);
  });
});
