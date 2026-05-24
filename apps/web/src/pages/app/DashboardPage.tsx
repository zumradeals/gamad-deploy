import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderGit2, Rocket, Server, ArrowRight, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/app/StatusBadge';
import { StatCardSkeleton, DeploymentRowSkeleton, ActivityItemSkeleton } from '@/components/app/Skeletons';
import { useAuthStore } from '@/store/auth.store';
import { useOrgStats, useAuditLog } from '@/api/orgs';
import { useDeployments } from '@/api/deployments';
import { useProjects } from '@/api/projects';

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-[--border] bg-[--surface] p-5 flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(16,185,129,0.1)] text-[--accent]">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-[--text-muted]">{label}</p>
        <p className="text-2xl font-bold font-display text-[--text]">{value}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { data: stats, isLoading: statsLoading } = useOrgStats(currentOrgId);
  const { data: deployments, isLoading: deplLoading } = useDeployments(currentOrgId);
  const { data: projects, isLoading: projLoading } = useProjects(currentOrgId);
  const { data: auditLog, isLoading: auditLoading } = useAuditLog(currentOrgId);

  const hasProjects = !projLoading && (projects?.length ?? 0) > 0;

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-[--text]">{t('title')}</h1>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={FolderGit2} label={t('stats.projects')} value={stats?.activeProjects ?? 0} />
            <StatCard icon={Rocket} label={t('stats.deployments')} value={stats?.runningDeployments ?? 0} />
            <StatCard icon={Server} label={t('stats.servers')} value={stats?.onlineServers ?? 0} />
          </>
        )}
      </section>

      {/* Onboarding empty state */}
      {!projLoading && !hasProjects && (
        <div className="rounded-lg border border-dashed border-[--border] bg-[rgba(16,185,129,0.03)] p-10 text-center">
          <FolderGit2 size={40} className="mx-auto mb-4 text-[--accent] opacity-60" />
          <h2 className="font-display text-lg font-semibold text-[--text] mb-2">{t('onboarding.title')}</h2>
          <p className="text-sm text-[--text-muted] mb-6 max-w-sm mx-auto">{t('onboarding.subtitle')}</p>
          <Link to="/app/projects/new">
            <Button className="gap-2">
              {t('onboarding.cta')} <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent deployments */}
        <section className="lg:col-span-2 rounded-lg border border-[--border] bg-[--surface]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[--border]">
            <h2 className="font-semibold text-[--text] text-sm">{t('recent.title')}</h2>
            {hasProjects && (
              <Link to="/app/projects" className="text-xs text-[--accent] hover:underline">
                {t('recent.view')}
              </Link>
            )}
          </div>
          <div className="px-5 divide-y divide-[--border]">
            {deplLoading ? (
              Array.from({ length: 4 }).map((_, i) => <DeploymentRowSkeleton key={i} />)
            ) : (deployments?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-[--text-muted]">{t('recent.empty')}</p>
            ) : (
              deployments?.map((d) => (
                <div key={d.id} className="flex items-center gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[--text] truncate">{d.projectName}</p>
                    <p className="text-xs text-[--text-muted] font-mono">{d.branch}</p>
                  </div>
                  <StatusBadge status={d.status} />
                  <div className="text-xs text-[--text-muted] shrink-0">
                    {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                  <Link to={`/app/deployments/${d.id}`} className="text-xs text-[--accent] hover:underline shrink-0">
                    {t('recent.view')}
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Activity */}
        <section className="rounded-lg border border-[--border] bg-[--surface]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[--border]">
            <Activity size={15} className="text-[--accent]" />
            <h2 className="font-semibold text-[--text] text-sm">{t('activity.title')}</h2>
          </div>
          <div className="px-5 py-2 divide-y divide-[--border]">
            {auditLoading ? (
              Array.from({ length: 4 }).map((_, i) => <ActivityItemSkeleton key={i} />)
            ) : (auditLog?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-[--text-muted]">{t('activity.empty')}</p>
            ) : (
              auditLog?.map((evt) => (
                <div key={evt.id} className="flex gap-3 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(16,185,129,0.1)] text-[--accent] text-xs font-bold">
                    {evt.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[--text] leading-snug">{evt.description}</p>
                    <p className="text-[10px] text-[--text-muted] mt-0.5">
                      {new Date(evt.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
