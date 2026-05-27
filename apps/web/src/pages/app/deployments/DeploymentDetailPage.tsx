import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Loader2, AlertCircle, Clock } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/app/StatusBadge';
import { DeploymentTerminal } from '@/components/app/DeploymentTerminal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useDeployment, useRollback } from '@/api/deployments';
import type { PipelineStepStatus } from '@/api/types';
import { cn } from '@/lib/utils';

const STEP_ICON: Record<PipelineStepStatus, React.ReactNode> = {
  pending: <Clock size={14} className="text-[--text-muted]" />,
  running: <Loader2 size={14} className="text-amber-400 animate-spin" />,
  done: <Check size={14} className="text-emerald-400" />,
  failed: <AlertCircle size={14} className="text-red-400" />,
};

export function DeploymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('deployment');
  const [rollbackOpen, setRollbackOpen] = useState(false);

  const { data: deployment, isLoading, isError } = useDeployment(id ?? '');
  const rollback = useRollback(id ?? '');

  const handleRollback = () => {
    rollback.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('rollback.success'));
        setRollbackOpen(false);
      },
      onError: () => {
        toast.error(t('rollback.error'));
      },
    });
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-[--text-muted]">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm">{t('detail.not_found')}</p>
      </div>
    );
  }

  if (isLoading || !deployment) {
    return (
      <div className="flex items-center justify-center h-64 text-[--text-muted]">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link to="/app/projects" className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text] transition-colors mb-2">
            <ArrowLeft size={13} />
            {t('detail.project')}
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-xl font-bold text-[--text]">
              {t('detail.title')} #{deployment.id.slice(0, 8)}
            </h1>
            <StatusBadge status={deployment.status} />
          </div>
          <div className="flex gap-4 text-xs text-[--text-muted]">
            <span>{t('detail.branch')} : <span className="font-mono text-[--text]">{deployment.branch}</span></span>
            {deployment.serverName && <span>{t('detail.server')} : {deployment.serverName}</span>}
            <span>{t('detail.started')} : {new Date(deployment.createdAt).toLocaleString('fr-FR')}</span>
          </div>
        </div>
        {deployment.status === 'FAILED' && (
          <Button
            variant="destructive"
            className="gap-2 shrink-0"
            onClick={() => setRollbackOpen(true)}
          >
            {t('rollback.button')}
          </Button>
        )}
      </div>

      {/* Pipeline steps */}
      <section className="rounded-lg border border-[--border] bg-[--surface]">
        <h2 className="px-5 py-4 font-semibold text-sm text-[--text] border-b border-[--border]">
          {t('steps.title')}
        </h2>
        <div className="divide-y divide-[--border]">
          {deployment.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(16,185,129,0.06)]">
                {STEP_ICON[step.status]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium',
                  step.status === 'failed' ? 'text-red-500' : 'text-[--text]',
                )}>
                  {t(`step.${step.name}`)}
                </p>
                <p className="text-xs text-[--text-muted]">{t(`step.status.${step.status}`)}</p>
              </div>
              {step.durationMs !== null && (
                <p className="text-xs text-[--text-muted] shrink-0 font-mono">
                  {t('step.duration', { ms: step.durationMs })}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Terminal */}
      <section>
        <h2 className="font-semibold text-sm text-[--text] mb-3">{t('logs.title')}</h2>
        <DeploymentTerminal deploymentId={deployment.id} initialStatus={deployment.status} />
      </section>

      {/* Rollback confirmation dialog */}
      <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rollback.confirm.title')}</DialogTitle>
            <DialogDescription>{t('rollback.confirm.desc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('rollback.confirm.cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRollback}
              disabled={rollback.isPending}
              className="gap-2"
            >
              {rollback.isPending && <Loader2 size={14} className="animate-spin" />}
              {t('rollback.confirm.yes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
