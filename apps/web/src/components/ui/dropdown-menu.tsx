import * as Radix from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = Radix.Root;
export const DropdownMenuTrigger = Radix.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof Radix.Content>) {
  return (
    <Radix.Portal>
      <Radix.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[180px] rounded-lg border border-[--border] bg-[--surface] p-1 shadow-lg',
          'data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </Radix.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Radix.Item>) {
  return (
    <Radix.Item
      className={cn(
        'flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-[--text]',
        'outline-none transition-colors hover:bg-[rgba(16,185,129,0.08)] focus:bg-[rgba(16,185,129,0.08)]',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof Radix.Separator>) {
  return <Radix.Separator className={cn('my-1 h-px bg-[--border]', className)} {...props} />;
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Radix.Label>) {
  return <Radix.Label className={cn('px-3 py-1.5 text-xs font-medium text-[--text-muted]', className)} {...props} />;
}
