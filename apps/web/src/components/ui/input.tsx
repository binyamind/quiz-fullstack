import * as React from 'react';
import { cn } from '@/lib/cn.ts';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-binding',
        className
      )}
      {...props}
    />
  );
});
