import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/store/auth.store';
import { useSettingsStore } from '@/store/settings.store';
import { useUpdateNotifications } from '@/api/settings';
import type { NotificationPrefs } from '@/api/types';

const TOGGLES: Array<{ key: keyof Omit<NotificationPrefs, 'webhookUrl'>; labelKey: string }> = [
  { key: 'deploySuccess', labelKey: 'notif.deploySuccess' },
  { key: 'deployFailed', labelKey: 'notif.deployFailed' },
  { key: 'rollback', labelKey: 'notif.rollback' },
  { key: 'renewalUpcoming', labelKey: 'notif.renewalUpcoming' },
];

const webhookSchema = z.object({
  webhookUrl: z.string().url('error.url').or(z.literal('')),
});
type WebhookForm = z.infer<typeof webhookSchema>;

export function NotificationsPage() {
  const { t } = useTranslation(['settings', 'common']);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { notifications, setNotification, setWebhookUrl } = useSettingsStore();
  const updateNotifications = useUpdateNotifications(currentOrgId);

  const [savingKey, setSavingKey] = useState<keyof Omit<NotificationPrefs, 'webhookUrl'> | null>(null);

  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<WebhookForm>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { webhookUrl: notifications?.webhookUrl ?? '' },
  });

  const onToggle = (key: keyof Omit<NotificationPrefs, 'webhookUrl'>, value: boolean) => {
    if (!notifications) return;
    // Optimistic update
    setNotification(key, value);
    setSavingKey(key);
    updateNotifications.mutate(
      { ...notifications, [key]: value },
      {
        onSuccess: () => { setSavingKey(null); },
        onError: () => {
          // Revert optimistic update
          setNotification(key, !value);
          setSavingKey(null);
          toast.error(t('save.error', { ns: 'settings' }));
        },
      },
    );
  };

  const onSaveWebhook = (data: WebhookForm) => {
    if (!notifications) return;
    updateNotifications.mutate(
      { ...notifications, webhookUrl: data.webhookUrl },
      {
        onSuccess: () => {
          setWebhookUrl(data.webhookUrl);
          toast.success(t('notif.saved', { ns: 'settings' }));
        },
        onError: () => toast.error(t('save.error', { ns: 'settings' })),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-[--text]">{t('notif.title', { ns: 'settings' })}</h1>
        <p className="text-sm text-[--text-muted] mt-1">{t('notif.desc', { ns: 'settings' })}</p>
      </div>

      {/* Toggle list */}
      <section className="rounded-lg border border-[--border] bg-[--surface] divide-y divide-[--border]">
        {TOGGLES.map(({ key, labelKey }) => (
          <div key={key} className="flex items-center justify-between px-5 py-4 gap-4">
            <Label htmlFor={`notif-${key}`} className="text-sm text-[--text] cursor-pointer">
              {t(labelKey, { ns: 'settings' })}
            </Label>
            <div className="flex items-center gap-2">
              {savingKey === key && <Loader2 size={13} className="animate-spin text-[--text-muted]" />}
              <Switch
                id={`notif-${key}`}
                checked={notifications?.[key] ?? false}
                onCheckedChange={(v) => onToggle(key, v)}
                disabled={savingKey === key}
              />
            </div>
          </div>
        ))}
      </section>

      {/* Webhook URL */}
      <section className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-4">
        <h2 className="font-semibold text-sm text-[--text]">{t('notif.webhook.title', { ns: 'settings' })}</h2>
        <form onSubmit={(e) => { void handleSubmit(onSaveWebhook)(e); }} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="webhookUrl">{t('notif.webhook.url', { ns: 'settings' })}</Label>
            <Input
              id="webhookUrl"
              placeholder={t('notif.webhook.placeholder', { ns: 'settings' })}
              {...register('webhookUrl')}
            />
            {errors.webhookUrl && (
              <p className="text-xs text-red-500">{t(errors.webhookUrl.message ?? 'error.url', { ns: 'common' })}</p>
            )}
            <p className="text-xs text-[--text-muted]">{t('notif.webhook.hint', { ns: 'settings' })}</p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={!isDirty || isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {t('notif.webhook.save', { ns: 'settings' })}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
