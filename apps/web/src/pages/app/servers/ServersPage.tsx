import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretRevealModal } from '@/components/app/SecretRevealModal';
import { HetznerComingSoonBadge } from '@/components/app/ComingSoonBadge';
import { useAuthStore } from '@/store/auth.store';
import { useServers, useCreateServer } from '@/api/servers';
import type { ServerCreatedResult } from '@/api/types';
import { cn } from '@/lib/utils';

const AGENT_IMAGE = 'ghcr.io/zumradeals/gamad-deploy/agent:latest';

const STATUS_CLASSES: Record<'online' | 'offline' | 'unknown', string> = {
  online: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  offline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  unknown: 'bg-[--border] text-[--text-muted]',
};

const serverSchema = z.object({
  name: z.string().min(1, 'error.required'),
  host: z.string().min(1, 'error.required'),
  port: z.coerce.number().int().min(1).max(65535),
});
type ServerForm = z.infer<typeof serverSchema>;

function buildInstallCommand(server: ServerCreatedResult): string {
  return [
    `docker run -d \\`,
    `  --name gamad-agent \\`,
    `  --restart unless-stopped \\`,
    `  -p ${server.port}:${server.port} \\`,
    `  -e "AGENT_TOKEN=${server.token}" \\`,
    `  -v /var/lib/gamad:/var/lib/gamad \\`,
    `  -v /var/run/docker.sock:/var/run/docker.sock \\`,
    `  -v /etc/nginx:/etc/nginx \\`,
    `  -v /etc/letsencrypt:/etc/letsencrypt \\`,
    `  --privileged \\`,
    `  ${AGENT_IMAGE}`,
  ].join('\n');
}

export function ServersPage() {
  const { t } = useTranslation(['servers', 'common']);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { data: servers, isLoading } = useServers(currentOrgId);
  const createServer = useCreateServer(currentOrgId);
  const [showForm, setShowForm] = useState(false);
  const [installData, setInstallData] = useState<ServerCreatedResult | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ServerForm>({
    resolver: zodResolver(serverSchema),
    defaultValues: { port: 7500 },
  });

  const onSubmit = (data: ServerForm) => {
    createServer.mutate(data, {
      onSuccess: (result) => {
        setShowForm(false);
        reset();
        setInstallData(result);
      },
      onError: () => toast.error(t('error.register', { ns: 'servers' })),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-[--text]">{t('title', { ns: 'servers' })}</h1>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus size={15} />
            {t('register', { ns: 'servers' })}
          </Button>
        )}
      </div>

      {/* Register form */}
      {showForm && (
        <form
          onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
          className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="serverName">{t('form.name', { ns: 'servers' })}</Label>
              <Input id="serverName" placeholder={t('form.name.placeholder', { ns: 'servers' })} {...register('name')} />
              {errors.name && <p className="text-xs text-red-500">{t(errors.name.message ?? 'error.required', { ns: 'common' })}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serverHost">{t('form.host', { ns: 'servers' })}</Label>
              <Input id="serverHost" placeholder={t('form.host.placeholder', { ns: 'servers' })} {...register('host')} />
              {errors.host && <p className="text-xs text-red-500">{t(errors.host.message ?? 'error.required', { ns: 'common' })}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serverPort">{t('form.port', { ns: 'servers' })}</Label>
              <Input id="serverPort" type="number" placeholder={t('form.port.placeholder', { ns: 'servers' })} {...register('port')} />
              {errors.port && <p className="text-xs text-red-500">{t(errors.port.message ?? 'error.required', { ns: 'common' })}</p>}
            </div>
          </div>
          <p className="text-xs text-[--text-muted]">{t('form.token.auto', { ns: 'servers' })}</p>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); reset(); }}>
              {t('btn.cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {t('form.submit', { ns: 'servers' })}
            </Button>
          </div>
        </form>
      )}

      {/* Servers list */}
      <div className="rounded-lg border border-[--border] bg-[--surface]">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 size={20} className="animate-spin mx-auto text-[--text-muted]" />
          </div>
        ) : (servers?.length ?? 0) === 0 ? (
          <div className="p-12 text-center">
            <Activity size={32} className="mx-auto mb-3 text-[--text-muted] opacity-40" />
            <p className="font-medium text-[--text]">{t('list.empty.title', { ns: 'servers' })}</p>
            <p className="text-sm text-[--text-muted] mt-1">{t('list.empty.subtitle', { ns: 'servers' })}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[--border]">
                {(['col.name', 'col.host', 'col.status'] as const).map((col, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-medium text-[--text-muted]">
                    {t(col, { ns: 'servers' })}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border]">
              {servers?.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-[--text]">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[--text-muted]">{s.host}:{s.port}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLASSES[s.status])}>
                      {t(`status.${s.status}`, { ns: 'servers' })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/app/servers/${s.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        {t('detail.title', { ns: 'servers' })}
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Hetzner Phase 2 coming soon */}
      <HetznerComingSoonBadge />

      {/* Installation modal — token visible une seule fois */}
      {installData && (
        <SecretRevealModal
          open={!!installData}
          onClose={() => setInstallData(null)}
          title={t('install.title', { ns: 'servers' })}
          description={t('install.desc', { ns: 'servers' })}
          secret={buildInstallCommand(installData)}
          confirmLabel={t('install.confirm', { ns: 'servers' })}
          closeLabel={t('install.close', { ns: 'servers' })}
          copyLabel={t('install.copy', { ns: 'servers' })}
          copiedLabel={t('install.copied', { ns: 'servers' })}
        />
      )}
    </div>
  );
}
