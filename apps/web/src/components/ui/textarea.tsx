import * as React from 'react';
import { cn } from '@/lib/cn.ts';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-32 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-binding',
        className
      )}
      {...props}
    />
  );
});
