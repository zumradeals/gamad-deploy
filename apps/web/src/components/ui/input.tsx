import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-[--border] bg-[--surface] px-3 py-2 text-sm text-[--text] font-body placeholder:text-[--text-muted] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
