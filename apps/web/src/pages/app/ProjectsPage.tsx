import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, FolderGit2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/app/StatusBadge';
import { ProjectCardSkeleton } from '@/components/app/Skeletons';
import { useAuthStore } from '@/store/auth.store';
import { useProjects } from '@/api/projects';
import type { DeploymentStatus } from '@/api/types';

const ALL_STATUSES: Array<DeploymentStatus | 'ALL'> = [
  'ALL', 'SUCCESS', 'RUNNING', 'FAILED', 'PENDING', 'ROLLED_BACK',
];

export function ProjectsPage() {
  const { t } = useTranslation(['project', 'deployment']);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { data: projects, isLoading } = useProjects(currentOrgId);
  const [statusFilter, setStatusFilter] = useState<DeploymentStatus | 'ALL'>('ALL');
  const navigate = useNavigate();

  const filtered = projects?.filter((p) =>
    statusFilter === 'ALL' || p.lastDeploymentStatus === statusFilter,
  ) ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[--text]">{t('list.title', { ns: 'project' })}</h1>
        <Link to="/app/projects/new">
          <Button className="gap-2">
            <Plus size={16} />
            {t('list.new', { ns: 'project' })}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      {!isLoading && (projects?.length ?? 0) > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[--text-muted]">{t('filter.status', { ns: 'project' })} :</span>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                statusFilter === s
                  ? 'bg-[--accent] text-white'
                  : 'border border-[--border] text-[--text-muted] hover:text-[--text]'
              }`}
            >
              {s === 'ALL' ? t('filter.all', { ns: 'project' }) : t(`status.${s}`, { ns: 'deployment' })}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ProjectCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[--border] bg-[rgba(16,185,129,0.02)] p-12 text-center">
          <FolderGit2 size={40} className="mx-auto mb-4 text-[--accent] opacity-50" />
          <h2 className="font-display text-lg font-semibold text-[--text] mb-2">
            {t('list.empty.title', { ns: 'project' })}
          </h2>
          <p className="text-sm text-[--text-muted] mb-6 max-w-sm mx-auto">
            {t('list.empty.subtitle', { ns: 'project' })}
          </p>
          <Link to="/app/projects/new">
            <Button className="gap-2">
              <Plus size={16} />
              {t('list.new', { ns: 'project' })}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-lg border border-[--border] bg-[--surface] hover:border-[--accent] transition-colors flex flex-col">
              {/* Card body — cliquable vers le dernier déploiement si disponible */}
              {p.lastDeploymentId ? (
                <Link
                  to={`/app/deployments/${p.lastDeploymentId}`}
                  className="block p-5 pb-3 space-y-3 flex-1"
                >
                  <div>
                    <p className="font-semibold text-[--text] truncate">{p.name}</p>
                    <p className="text-xs text-[--text-muted] font-mono truncate mt-0.5">{p.repoUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[--text-muted]">
                    <span>{t('card.server', { ns: 'project' })} : {p.serverName}</span>
                  </div>
                </Link>
              ) : (
                <div className="p-5 pb-3 space-y-3 flex-1">
                  <div>
                    <p className="font-semibold text-[--text] truncate">{p.name}</p>
                    <p className="text-xs text-[--text-muted] font-mono truncate mt-0.5">{p.repoUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[--text-muted]">
                    <span>{t('card.server', { ns: 'project' })} : {p.serverName}</span>
                  </div>
                </div>
              )}
              {/* Action bar */}
              <div className="flex items-center justify-between px-5 pb-5 pt-2 border-t border-[--border]">
                <div>
                  {p.lastDeploymentStatus ? (
                    <StatusBadge status={p.lastDeploymentStatus} />
                  ) : (
                    <span className="text-xs text-[--text-muted]">{t('card.never', { ns: 'project' })}</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() => navigate('/app/projects/new', {
                    state: { repoUrl: p.repoUrl, branch: p.branch, serverId: p.serverId },
                  })}
                >
                  <Rocket size={12} />
                  {t('card.deploy', { ns: 'project' })}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
