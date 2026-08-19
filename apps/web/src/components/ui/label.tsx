import type { ComponentProps } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/cn.ts';

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-sm font-medium text-ink', className)}
      {...props}
    />
  );
}
