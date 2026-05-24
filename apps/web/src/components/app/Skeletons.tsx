import { cn } from '@/lib/utils';

function Pulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-[--border]', className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-3">
      <Pulse className="h-4 w-28" />
      <Pulse className="h-8 w-16" />
    </div>
  );
}

export function DeploymentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[--border] last:border-0">
      <Pulse className="h-4 w-32" />
      <Pulse className="h-4 w-20" />
      <Pulse className="h-5 w-16 rounded-full" />
      <Pulse className="h-4 w-24 ml-auto" />
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-3">
      <Pulse className="h-5 w-40" />
      <Pulse className="h-4 w-56" />
      <div className="flex gap-2 pt-2">
        <Pulse className="h-5 w-16 rounded-full" />
        <Pulse className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function ActivityItemSkeleton() {
  return (
    <div className="flex gap-3 py-2">
      <Pulse className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Pulse className="h-4 w-3/4" />
        <Pulse className="h-3 w-1/4" />
      </div>
    </div>
  );
}
