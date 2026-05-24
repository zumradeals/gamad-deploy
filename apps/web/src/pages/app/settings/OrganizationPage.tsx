import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DangerConfirmDialog } from '@/components/app/DangerConfirmDialog';
import { useAuthStore } from '@/store/auth.store';
import { useSettingsStore } from '@/store/settings.store';
import { useUpdateOrg, useOrgMembers, useInviteMember, useRevokeMember, useDeleteOrg } from '@/api/settings';
import type { OrgMember } from '@/api/types';

const orgSchema = z.object({ name: z.string().min(1, 'error.required') });
type OrgForm = z.infer<typeof orgSchema>;

const inviteSchema = z.object({ email: z.string().email('error.email') });
type InviteForm = z.infer<typeof inviteSchema>;

const ROLE_LABELS: Record<OrgMember['role'], string> = {
  owner: 'org.members.role.owner',
  admin: 'org.members.role.admin',
  member: 'org.members.role.member',
};

export function OrganizationPage() {
  const { t } = useTranslation(['settings', 'common']);
  const navigate = useNavigate();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { orgSettings, setOrgSettings } = useSettingsStore();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updateOrg = useUpdateOrg(currentOrgId);
  const deleteOrg = useDeleteOrg(currentOrgId);
  const { data: members } = useOrgMembers(currentOrgId);
  const inviteMember = useInviteMember(currentOrgId);
  const revokeMember = useRevokeMember(currentOrgId);
  const [revokeTarget, setRevokeTarget] = useState<OrgMember | null>(null);

  const { register: regOrg, handleSubmit: hsOrg, formState: { errors: orgErrors, isDirty, isSubmitting } } = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: orgSettings?.name ?? '' },
  });

  const { register: regInvite, handleSubmit: hsInvite, reset: resetInvite, formState: { errors: inviteErrors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  });

  const onSaveOrg = (data: OrgForm) => {
    updateOrg.mutate(data, {
      onSuccess: (updated) => { setOrgSettings(updated); toast.success(t('org.saved', { ns: 'settings' })); },
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  const onInvite = (data: InviteForm) => {
    inviteMember.mutate(
      { email: data.email, role: 'member' },
      { onSuccess: () => { resetInvite(); toast.success(t('org.members.invited', { ns: 'settings' })); }, onError: () => toast.error(t('save.error', { ns: 'settings' })) },
    );
  };

  const onRevoke = (member: OrgMember) => {
    revokeMember.mutate(member.userId, {
      onSuccess: () => { setRevokeTarget(null); toast.success(t('org.members.revoked', { ns: 'settings' })); },
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  const onDeleteOrg = () => {
    deleteOrg.mutate(undefined, {
      onSuccess: () => { setDeleteOpen(false); void navigate('/app/dashboard'); toast.success(t('org.deleted', { ns: 'settings' })); },
      onError: () => toast.error(t('save.error', { ns: 'settings' })),
    });
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-xl font-bold text-[--text]">{t('org.title', { ns: 'settings' })}</h1>

      {/* Org name */}
      <section className="rounded-lg border border-[--border] bg-[--surface] p-6 space-y-4">
        <form onSubmit={(e) => { void hsOrg(onSaveOrg)(e); }} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="orgName">{t('org.name', { ns: 'settings' })}</Label>
            <Input id="orgName" placeholder={t('org.name.placeholder', { ns: 'settings' })} {...regOrg('name')} />
            {orgErrors.name && <p className="text-xs text-red-500">{t(orgErrors.name.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('org.slug', { ns: 'settings' })}</Label>
            <Input value={orgSettings?.slug ?? ''} disabled className="opacity-70 font-mono" />
            <p className="text-xs text-[--text-muted]">{t('org.slug.hint', { ns: 'settings' })}</p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!isDirty || isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {t('org.save', { ns: 'settings' })}
            </Button>
          </div>
        </form>
      </section>

      {/* Members */}
      <section className="rounded-lg border border-[--border] bg-[--surface]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--border]">
          <h2 className="font-semibold text-[--text] text-sm">{t('org.members.title', { ns: 'settings' })}</h2>
        </div>
        <div className="divide-y divide-[--border]">
          {members?.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-6 py-3 gap-4">
              <div>
                <p className="text-sm font-medium text-[--text]">{m.name}</p>
                <p className="text-xs text-[--text-muted]">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[--text-muted]">{t(ROLE_LABELS[m.role], { ns: 'settings' })}</span>
                {m.role !== 'owner' && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600 gap-1"
                    onClick={() => setRevokeTarget(m)}>
                    <Trash2 size={12} />
                    {t('org.members.revoke', { ns: 'settings' })}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Invite form */}
        <div className="px-6 py-4 border-t border-[--border]">
          <form onSubmit={(e) => { void hsInvite(onInvite)(e); }} className="flex gap-3" noValidate>
            <div className="flex-1">
              <Input placeholder={t('org.members.email.placeholder', { ns: 'settings' })} {...regInvite('email')} />
              {inviteErrors.email && <p className="text-xs text-red-500 mt-1">{t(inviteErrors.email.message ?? 'error.email', { ns: 'common' })}</p>}
            </div>
            <Button type="submit" variant="outline" disabled={inviteMember.isPending} className="gap-2 shrink-0">
              {inviteMember.isPending && <Loader2 size={14} className="animate-spin" />}
              {t('org.members.invite', { ns: 'settings' })}
            </Button>
          </form>
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-red-200 dark:border-red-900/50 bg-[--surface] p-6 space-y-3">
        <h2 className="font-semibold text-red-600 dark:text-red-400 text-sm">{t('org.danger.title', { ns: 'settings' })}</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[--text]">{t('org.danger.delete', { ns: 'settings' })}</p>
            <p className="text-xs text-[--text-muted] mt-0.5">{t('org.danger.delete.desc', { ns: 'settings' })}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="shrink-0">
            {t('org.danger.delete', { ns: 'settings' })}
          </Button>
        </div>
      </section>

      {/* Revoke member confirm */}
      <DangerConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}
        title={t('org.members.revoke.confirm.title', { ns: 'settings' })}
        description={t('org.members.revoke.confirm.desc', { ns: 'settings' })}
        targetName={revokeTarget?.email ?? ''}
        confirmPrompt={revokeTarget?.email ?? ''}
        confirmLabel={t('org.members.revoke.confirm.yes', { ns: 'settings' })}
        cancelLabel={t('btn.cancel', { ns: 'common' })}
        onConfirm={() => revokeTarget && onRevoke(revokeTarget)}
        isLoading={revokeMember.isPending}
      />

      {/* Delete org confirm */}
      <DangerConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('org.danger.confirm.title', { ns: 'settings' })}
        description={t('org.danger.confirm.desc', { ns: 'settings' })}
        targetName={orgSettings?.name ?? ''}
        confirmPrompt={t('org.danger.confirm.prompt', { ns: 'settings', name: orgSettings?.name ?? '' })}
        confirmLabel={t('org.danger.confirm.yes', { ns: 'settings' })}
        cancelLabel={t('btn.cancel', { ns: 'common' })}
        onConfirm={onDeleteOrg}
        isLoading={deleteOrg.isPending}
      />
    </div>
  );
}
