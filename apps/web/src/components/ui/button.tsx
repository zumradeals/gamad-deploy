import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium font-body transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[--accent] text-white hover:bg-[--accent-dark] shadow-sm shadow-[rgba(16,185,129,0.3)]',
        outline:
          'border border-[--border] bg-transparent hover:bg-[rgba(16,185,129,0.08)] text-[--text]',
        ghost:
          'bg-transparent hover:bg-[rgba(16,185,129,0.08)] text-[--text]',
        secondary:
          'bg-[--surface] border border-[--border] text-[--text] hover:border-[--accent]',
        destructive:
          'bg-red-600 text-white hover:bg-red-700',
        link:
          'text-[--accent] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-5 py-2',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
