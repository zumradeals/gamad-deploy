import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ArrowLeft, RefreshCw, Terminal } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { SecretRevealModal } from '@/components/app/SecretRevealModal';
import { DangerConfirmDialog } from '@/components/app/DangerConfirmDialog';
import { useServerDetail, useTestServerConnection, useRegenerateServerToken } from '@/api/servers';
import type { RegenerateTokenResponse } from '@/api/types';
import { buildDockerRunCommand, buildMaskedDockerRunCommand } from '@/lib/agent';
import { cn } from '@/lib/utils';

const STATUS_CLASSES: Record<'online' | 'offline' | 'unknown', string> = {
  online: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  offline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  unknown: 'bg-[--border] text-[--text-muted]',
};

export function ServerDetailPage() {
  const { t } = useTranslation(['servers', 'common', 'settings']);
  const { serverId = '' } = useParams<{ serverId: string }>();
  const { data: server, isLoading } = useServerDetail(serverId);
  const pingServer = useTestServerConnection(serverId);
  const regenerateToken = useRegenerateServerToken(serverId);

  const [pingResult, setPingResult] = useState<{ latencyMs: number } | null>(null);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [revealData, setRevealData] = useState<RegenerateTokenResponse | null>(null);
  const [showInstallCommand, setShowInstallCommand] = useState(false);

  const onPing = () => {
    setPingResult(null);
    pingServer.mutate(undefined, {
      onSuccess: (res) => { setPingResult(res); toast.success(t('detail.ping.success', { ns: 'servers' })); },
      onError: () => toast.error(t('detail.ping.error', { ns: 'servers' })),
    });
  };

  const onRegenerate = () => {
    regenerateToken.mutate(undefined, {
      onSuccess: (res) => {
        setRegenConfirmOpen(false);
        setRevealData(res);
      },
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Loader2 size={24} className="animate-spin mx-auto text-[--text-muted]" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="p-8 text-center text-sm text-[--text-muted]">
        Serveur introuvable.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/app/servers">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <ArrowLeft size={13} />
            {t('title', { ns: 'servers' })}
          </Button>
        </Link>
      </div>

      {/* Info card */}
      <section className="rounded-lg border border-[--border] bg-[--surface] p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h1 className="font-display text-xl font-bold text-[--text]">{server.name}</h1>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CLASSES[server.status])}>
            {t(`status.${server.status}`, { ns: 'servers' })}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-[--text-muted] text-xs">{t('detail.host', { ns: 'servers' })}</dt>
            <dd className="font-mono text-[--text] mt-0.5">{server.host}:{server.port}</dd>
          </div>
          <div>
            <dt className="text-[--text-muted] text-xs">{t('detail.agentVersion', { ns: 'servers' })}</dt>
            <dd className="text-[--text] mt-0.5">{server.agentVersion}</dd>
          </div>
          <div>
            <dt className="text-[--text-muted] text-xs">{t('detail.lastActivity', { ns: 'servers' })}</dt>
            <dd className="text-[--text] mt-0.5">
              {server.lastActivityAt
                ? new Date(server.lastActivityAt).toLocaleString('fr-FR')
                : t('col.never', { ns: 'servers' })}
            </dd>
          </div>
          {pingResult && (
            <div>
              <dt className="text-[--text-muted] text-xs">{t('detail.ping', { ns: 'servers' })}</dt>
              <dd className="text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono text-xs">{pingResult.latencyMs} ms</dd>
            </div>
          )}
        </dl>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={pingServer.isPending}
            onClick={onPing}
          >
            {pingServer.isPending && <Loader2 size={12} className="animate-spin" />}
            {t('detail.ping', { ns: 'servers' })}
          </Button>
        </div>
      </section>

      {/* Installation command */}
      <section className="rounded-lg border border-[--border] bg-[--surface] p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-[--text]">{t('install.section.title', { ns: 'servers' })}</h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={() => setShowInstallCommand((v) => !v)}
          >
            <Terminal size={12} />
            {showInstallCommand ? t('install.section.hide', { ns: 'servers' }) : t('install.section.show', { ns: 'servers' })}
          </Button>
        </div>
        {showInstallCommand && (
          <>
            <pre className="overflow-x-auto rounded-lg bg-[#0d1117] px-4 py-3 font-mono text-xs text-emerald-400 border border-white/10 select-all whitespace-pre">
              {buildMaskedDockerRunCommand(server.port, server.tokenSuffix)}
            </pre>
            <p className="text-xs text-[--text-muted]">{t('install.section.hint', { ns: 'servers' })}</p>
          </>
        )}
      </section>

      {/* Agent token */}
      <section className="rounded-lg border border-[--border] bg-[--surface] p-6 space-y-3">
        <h2 className="font-semibold text-sm text-[--text]">{t('detail.token', { ns: 'servers' })}</h2>
        <div className="flex items-center justify-between gap-4">
          <code className="font-mono text-sm text-[--text-muted]">
            {t('detail.token.value', { ns: 'servers', suffix: server.tokenSuffix })}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={() => setRegenConfirmOpen(true)}
          >
            <RefreshCw size={12} />
            {t('detail.token.regenerate', { ns: 'servers' })}
          </Button>
        </div>
        <p className="text-xs text-[--text-muted]">{t('detail.token.hint', { ns: 'servers' })}</p>
      </section>

      {/* Deployed projects */}
      <section className="rounded-lg border border-[--border] bg-[--surface]">
        <div className="px-5 py-4 border-b border-[--border]">
          <h2 className="font-semibold text-sm text-[--text]">{t('detail.projects', { ns: 'servers' })}</h2>
        </div>
        {server.deployedProjects.length === 0 ? (
          <p className="p-6 text-sm text-center text-[--text-muted]">{t('detail.projects.empty', { ns: 'servers' })}</p>
        ) : (
          <ul className="divide-y divide-[--border]">
            {server.deployedProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3 gap-3">
                <span className="text-sm font-medium text-[--text]">{p.name}</span>
                <Link to={`/app/projects/${p.id}`}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    {p.status}
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Regenerate token confirmation */}
      <DangerConfirmDialog
        open={regenConfirmOpen}
        onOpenChange={(o) => { if (!o) setRegenConfirmOpen(false); }}
        title={t('detail.token.regenerate.confirm.title', { ns: 'servers' })}
        description={t('detail.token.regenerate.confirm.desc', { ns: 'servers' })}
        targetName={server.name}
        confirmPrompt={server.name}
        confirmLabel={t('detail.token.regenerate.confirm.yes', { ns: 'servers' })}
        cancelLabel={t('btn.cancel', { ns: 'common' })}
        onConfirm={onRegenerate}
        isLoading={regenerateToken.isPending}
      />

      {/* Reveal modal après régénération — affiche la commande d'installation complète */}
      <SecretRevealModal
        open={!!revealData}
        onClose={() => setRevealData(null)}
        title={t('detail.token.reveal.title', { ns: 'servers' })}
        description={t('detail.token.reveal.desc', { ns: 'servers' })}
        secret={revealData ? buildDockerRunCommand(revealData.port, revealData.token) : ''}
        confirmLabel={t('detail.token.reveal.confirm', { ns: 'servers' })}
        closeLabel={t('apiKeys.reveal.close', { ns: 'settings' })}
        copyLabel={t('apiKeys.reveal.copy', { ns: 'settings' })}
        copiedLabel={t('apiKeys.reveal.copied', { ns: 'settings' })}
      />
    </div>
  );
}
