import { describe, expect, it } from 'vitest';
import { cn } from './cn.ts';

describe('cn', () => {
  it('merges tailwind classes', () => {
    const extra: string | false = false;
    expect(cn('p-2', 'p-4', extra && 'hidden')).toBe('p-4');
  });
});
