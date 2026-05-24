import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { DangerConfirmDialog } from '@/components/app/DangerConfirmDialog';
import { useAuthStore } from '@/store/auth.store';
import { useSettingsStore } from '@/store/settings.store';
import { useRequestDataExport, useDeleteAccount } from '@/api/settings';
import { useState } from 'react';

export function DangerPage() {
  const { t } = useTranslation(['settings', 'common']);
  const navigate = useNavigate();
  const { profile } = useSettingsStore();
  const logout = useAuthStore((s) => s.logout);
  const requestExport = useRequestDataExport();
  const deleteAccount = useDeleteAccount();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const onExport = () => {
    requestExport.mutate(undefined, {
      onSuccess: () => toast.success(t('danger.export.requested', { ns: 'settings' })),
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  const onDeleteAccount = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setDeleteOpen(false);
        logout();
        void navigate('/');
      },
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold text-[--text]">{t('danger.title', { ns: 'settings' })}</h1>

      {/* Export RGPD */}
      <section className="rounded-lg border border-[--border] bg-[--surface] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[--text]">{t('danger.export.title', { ns: 'settings' })}</p>
            <p className="text-xs text-[--text-muted] mt-0.5">{t('danger.export.desc', { ns: 'settings' })}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={requestExport.isPending}
            onClick={onExport}
          >
            {t('danger.export.button', { ns: 'settings' })}
          </Button>
        </div>
      </section>

      {/* Delete account */}
      <section className="rounded-lg border border-red-200 dark:border-red-900/50 bg-[--surface] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[--text]">{t('danger.delete.title', { ns: 'settings' })}</p>
            <p className="text-xs text-[--text-muted] mt-0.5">{t('danger.delete.desc', { ns: 'settings' })}</p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setDeleteOpen(true)}
          >
            {t('danger.delete.button', { ns: 'settings' })}
          </Button>
        </div>
      </section>

      <DangerConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('danger.delete.confirm.title', { ns: 'settings' })}
        description={t('danger.delete.confirm.desc', { ns: 'settings' })}
        targetName={profile?.email ?? ''}
        confirmPrompt={t('danger.delete.confirm.prompt', { ns: 'settings' })}
        confirmLabel={t('danger.delete.confirm.yes', { ns: 'settings' })}
        cancelLabel={t('btn.cancel', { ns: 'common' })}
        onConfirm={onDeleteAccount}
        isLoading={deleteAccount.isPending}
      />
    </div>
  );
}
