import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettingsStore } from '@/store/settings.store';
import { useUpdateProfile, useChangePassword } from '@/api/settings';

// ── Profile form ──────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, 'error.required'),
  language: z.enum(['fr', 'en']),
  theme: z.enum(['light', 'dark', 'system']),
});
type ProfileForm = z.infer<typeof profileSchema>;

function ProfileForm() {
  const { t } = useTranslation(['settings', 'common']);
  const { profile, setProfile } = useSettingsStore();
  const update = useUpdateProfile();

  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile?.name ?? '', language: profile?.language ?? 'fr', theme: profile?.theme ?? 'system' },
  });

  const onSubmit = (data: ProfileForm) => {
    update.mutate(data, {
      onSuccess: (updated) => { setProfile(updated); toast.success(t('profile.saved', { ns: 'settings' })); },
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t('profile.name', { ns: 'settings' })}</Label>
        <Input id="name" placeholder={t('profile.name.placeholder', { ns: 'settings' })} {...register('name')} />
        {errors.name && <p className="text-xs text-red-500">{t(errors.name.message ?? 'error.required', { ns: 'common' })}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('profile.email', { ns: 'settings' })}</Label>
        <Input id="email" value={profile?.email ?? ''} disabled className="opacity-70" />
        {profile?.pendingEmail && (
          <p className="text-xs text-amber-500">{t('profile.email.pending', { ns: 'settings', email: profile.pendingEmail })}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="language">{t('profile.lang', { ns: 'settings' })}</Label>
          <select
            id="language"
            {...register('language')}
            className="w-full rounded-md border border-[--border] bg-[--surface] px-3 py-2 text-sm text-[--text] focus:outline-none focus:ring-2 focus:ring-[--accent]"
          >
            <option value="fr">{t('profile.lang.fr', { ns: 'settings' })}</option>
            <option value="en">{t('profile.lang.en', { ns: 'settings' })}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="theme">{t('profile.theme', { ns: 'settings' })}</Label>
          <select
            id="theme"
            {...register('theme')}
            className="w-full rounded-md border border-[--border] bg-[--surface] px-3 py-2 text-sm text-[--text] focus:outline-none focus:ring-2 focus:ring-[--accent]"
          >
            <option value="light">{t('profile.theme.light', { ns: 'settings' })}</option>
            <option value="dark">{t('profile.theme.dark', { ns: 'settings' })}</option>
            <option value="system">{t('profile.theme.system', { ns: 'settings' })}</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={!isDirty || isSubmitting} className="gap-2">
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          {t('profile.save', { ns: 'settings' })}
        </Button>
      </div>
    </form>
  );
}

// ── Password form ─────────────────────────────────────────────────────────────

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'error.required'),
  newPassword: z.string().min(8, 'register.password.min'),
  confirmPassword: z.string().min(1, 'error.required'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'profile.password.mismatch',
  path: ['confirmPassword'],
});
type PasswordForm = z.infer<typeof passwordSchema>;

function PasswordForm() {
  const { t } = useTranslation(['settings', 'common', 'auth']);
  const changePassword = useChangePassword();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = (data: PasswordForm) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => { reset(); toast.success(t('profile.password.saved', { ns: 'settings' })); },
        onError: () => toast.error(t('save.error', { ns: 'settings' })),
      },
    );
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{t('profile.password.current', { ns: 'settings' })}</Label>
        <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} />
        {errors.currentPassword && <p className="text-xs text-red-500">{t(errors.currentPassword.message ?? 'error.required', { ns: 'common' })}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{t('profile.password.new', { ns: 'settings' })}</Label>
        <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
        {errors.newPassword && <p className="text-xs text-red-500">{t(errors.newPassword.message ?? 'error.required', { ns: 'common' })}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">{t('profile.password.confirm', { ns: 'settings' })}</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
        {errors.confirmPassword && (
          <p className="text-xs text-red-500">
            {t(errors.confirmPassword.message ?? 'error.required', { ns: errors.confirmPassword.message?.startsWith('profile') ? 'settings' : 'common' })}
          </p>
        )}
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          {t('profile.password.save', { ns: 'settings' })}
        </Button>
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-bold text-[--text]">{t('profile.title')}</h1>
      </div>
      <section className="rounded-lg border border-[--border] bg-[--surface] p-6">
        <ProfileForm />
      </section>
      <section className="rounded-lg border border-[--border] bg-[--surface] p-6">
        <h2 className="font-semibold text-[--text] mb-4">{t('profile.password.title')}</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
