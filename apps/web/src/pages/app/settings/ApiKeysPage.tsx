import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretRevealModal } from '@/components/app/SecretRevealModal';
import { DangerConfirmDialog } from '@/components/app/DangerConfirmDialog';
import { useAuthStore } from '@/store/auth.store';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/api/settings';
import type { ApiKey, CreateApiKeyResponse } from '@/api/types';
import { cn } from '@/lib/utils';

const SCOPES: Array<{ value: ApiKey['scope']; labelKey: string }> = [
  { value: 'read', labelKey: 'apiKeys.scope.read' },
  { value: 'deploy', labelKey: 'apiKeys.scope.deploy' },
  { value: 'admin', labelKey: 'apiKeys.scope.admin' },
];

const keyFormSchema = z.object({
  name: z.string().min(1, 'error.required'),
  scope: z.enum(['read', 'deploy', 'admin']),
});
type KeyForm = z.infer<typeof keyFormSchema>;

export function ApiKeysPage() {
  const { t } = useTranslation(['settings', 'common']);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { data: keys, isLoading } = useApiKeys(currentOrgId);
  const createKey = useCreateApiKey(currentOrgId);
  const revokeKey = useRevokeApiKey(currentOrgId);

  // The newly created key lives ONLY in mutation.data — never copied to store
  const [revealData, setRevealData] = useState<CreateApiKeyResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<KeyForm>({
    resolver: zodResolver(keyFormSchema),
    defaultValues: { scope: 'deploy' },
  });
  const selectedScope = watch('scope');

  const onSubmit = (data: KeyForm) => {
    createKey.mutate(data, {
      onSuccess: (created) => {
        setRevealData(created);
        setShowForm(false);
        reset();
        toast.success(t('apiKeys.created', { ns: 'settings' }));
      },
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  const onRevoke = () => {
    if (!revokeTarget) return;
    revokeKey.mutate(revokeTarget.id, {
      onSuccess: () => { setRevokeTarget(null); toast.success(t('apiKeys.revoked', { ns: 'settings' })); },
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-[--text]">{t('apiKeys.title', { ns: 'settings' })}</h1>
          <p className="text-sm text-[--text-muted] mt-1">{t('apiKeys.desc', { ns: 'settings' })}</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus size={15} />
            {t('apiKeys.create', { ns: 'settings' })}
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
          className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="keyName">{t('apiKeys.form.name', { ns: 'settings' })}</Label>
            <Input id="keyName" placeholder={t('apiKeys.form.name.placeholder', { ns: 'settings' })} {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('apiKeys.form.scope', { ns: 'settings' })}</Label>
            <div className="flex gap-2">
              {SCOPES.map(({ value, labelKey }) => (
                <button key={value} type="button"
                  onClick={() => setValue('scope', value)}
                  className={cn(
                    'rounded-lg border-2 px-4 py-2 text-sm transition-all',
                    selectedScope === value
                      ? 'border-[--accent] bg-[rgba(16,185,129,0.06)] text-[--accent] font-medium'
                      : 'border-[--border] text-[--text-muted] hover:border-[rgba(16,185,129,0.5)]',
                  )}>
                  {t(labelKey, { ns: 'settings' })}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); reset(); }}>
              {t('btn.cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {t('apiKeys.create', { ns: 'settings' })}
            </Button>
          </div>
        </form>
      )}

      {/* Keys table */}
      <div className="rounded-lg border border-[--border] bg-[--surface]">
        {isLoading ? (
          <div className="p-8 text-center text-[--text-muted] text-sm">
            <Loader2 size={20} className="animate-spin mx-auto mb-2" />
          </div>
        ) : (keys?.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-sm text-[--text-muted]">{t('apiKeys.empty', { ns: 'settings' })}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[--border]">
                {(['apiKeys.col.name', 'apiKeys.col.scope', 'apiKeys.col.suffix', 'apiKeys.col.lastUsed', ''] as const).map((col, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-medium text-[--text-muted]">
                    {col ? t(col, { ns: 'settings' }) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border]">
              {keys?.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 font-medium text-[--text]">{k.name}</td>
                  <td className="px-4 py-3 text-[--text-muted]">{t(`apiKeys.scope.${k.scope}`, { ns: 'settings' })}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[--text-muted]">...{k.suffix}</td>
                  <td className="px-4 py-3 text-xs text-[--text-muted]">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('fr-FR') : t('apiKeys.col.never', { ns: 'settings' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-red-500 hover:text-red-600"
                      onClick={() => setRevokeTarget(k)}>
                      <Trash2 size={12} />
                      {t('apiKeys.revoke', { ns: 'settings' })}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Single-reveal modal — secret lives only in revealData, never in store */}
      <SecretRevealModal
        open={!!revealData}
        onClose={() => setRevealData(null)}
        title={t('apiKeys.reveal.title', { ns: 'settings' })}
        description={t('apiKeys.reveal.desc', { ns: 'settings' })}
        secret={revealData?.key ?? ''}
        confirmLabel={t('apiKeys.reveal.confirm', { ns: 'settings' })}
        closeLabel={t('apiKeys.reveal.close', { ns: 'settings' })}
        copyLabel={t('apiKeys.reveal.copy', { ns: 'settings' })}
        copiedLabel={t('apiKeys.reveal.copied', { ns: 'settings' })}
      />

      {/* Revoke confirmation */}
      <DangerConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}
        title={t('apiKeys.revoke.confirm.title', { ns: 'settings' })}
        description={t('apiKeys.revoke.confirm.desc', { ns: 'settings' })}
        targetName={revokeTarget?.name ?? ''}
        confirmPrompt={revokeTarget?.name ?? ''}
        confirmLabel={t('apiKeys.revoke.confirm.yes', { ns: 'settings' })}
        cancelLabel={t('btn.cancel', { ns: 'common' })}
        onConfirm={onRevoke}
        isLoading={revokeKey.isPending}
      />
    </div>
  );
}
