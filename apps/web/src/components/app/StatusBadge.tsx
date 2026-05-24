import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { DeploymentStatus } from '@/api/types';

const STATUS_CLASSES: Record<DeploymentStatus, string> = {
  PENDING:
    'bg-[--surface] border border-[--border] text-[--text-muted]',
  RUNNING:
    'bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700/40 dark:text-amber-400 animate-pulse',
  SUCCESS:
    'bg-emerald-100 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700/40 dark:text-emerald-400',
  FAILED:
    'bg-red-100 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700/40 dark:text-red-400',
  ROLLED_BACK:
    'bg-purple-100 border border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700/40 dark:text-purple-400',
};

interface StatusBadgeProps {
  status: DeploymentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation('deployment');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_CLASSES[status],
        className,
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}
