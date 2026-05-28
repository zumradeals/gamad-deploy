// AdminUserDetailPage — profil complet d'un utilisateur (Phase 2 superadmin).
// Affiche : infos + orgs membres + boutons d'action + impersonation.

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Ban, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useAdminUserDetail,
  useChangeUserRole,
  useSuspendUser,
  useImpersonateUser,
} from '@/api/admin';

function PlatformRoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-gray-500">—</span>;
  const variants: Record<string, string> = {
    superadmin: 'bg-red-500/15 text-red-400 border-red-500/20',
    support: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    user: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[role] ?? variants['user']}`}>
      {role}
    </span>
  );
}

function OrgRoleBadge({ role }: { role: string }) {
  const variants: Record<string, string> = {
    owner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    admin: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    member: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${variants[role] ?? variants['member']}`}>
      {role}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-5 w-32 rounded bg-gray-700" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-gray-900 border-gray-800 p-5 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-24 rounded bg-gray-700" />
              <div className="h-4 w-36 rounded bg-gray-700" />
            </div>
          ))}
        </Card>
        <Card className="bg-gray-900 border-gray-800 p-5 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-800" />
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading } = useAdminUserDetail(id ?? '');
  const changeRole = useChangeUserRole();
  const suspendUser = useSuspendUser();
  const impersonate = useImpersonateUser();

  if (isLoading || !user) return <PageSkeleton />;

  const handleChangeRole = () => {
    const roles = ['user', 'support', 'superadmin'] as const;
    const current = (user.platformRole as typeof roles[number]) ?? 'user';
    const newRole = window.prompt(
      `Nouveau rôle pour ${user.email} (user / support / superadmin) :`,
      current,
    ) as typeof roles[number] | null;
    if (!newRole || !roles.includes(newRole)) return;
    changeRole.mutate(
      { id: user.id, role: newRole },
      {
        onSuccess: () => toast.success(`Rôle changé en "${newRole}"`),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const handleSuspend = () => {
    const action = user.suspendedAt ? 'réactiver' : 'suspendre';
    if (!window.confirm(`Voulez-vous ${action} le compte de ${user.email} ?`)) return;
    suspendUser.mutate(
      { id: user.id, suspend: !user.suspendedAt },
      {
        onSuccess: () => toast.success(`Compte ${user.suspendedAt ? 'réactivé' : 'suspendu'}`),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const handleImpersonate = () => {
    impersonate.mutate(user.id, {
      onSuccess: ({ token }) => {
        void navigator.clipboard.writeText(token).then(() => {
          toast.success('Token d\'impersonation copié dans le presse-papier. Valide 1h.', {
            duration: 6000,
          });
        });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/users')}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 px-2"
        >
          <ArrowLeft size={14} className="mr-1" />
          Retour
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white">{user.fullName ?? user.email}</h1>
          <p className="text-sm text-gray-400">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Infos utilisateur */}
        <Card className="bg-gray-900 border-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Informations</h2>
          <div className="space-y-3">
            <InfoRow label="ID" value={<span className="font-mono text-xs text-gray-300">{user.id}</span>} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Nom complet" value={user.fullName ?? '—'} />
            <InfoRow
              label="Rôle plateforme"
              value={<PlatformRoleBadge role={user.platformRole} />}
            />
            <InfoRow
              label="Statut"
              value={
                user.suspendedAt ? (
                  <span className="text-red-400 text-xs">
                    Suspendu le {new Date(user.suspendedAt).toLocaleDateString('fr-FR')}
                  </span>
                ) : (
                  <span className="text-emerald-400 text-xs">Actif</span>
                )
              }
            />
            <InfoRow
              label="Créé le"
              value={new Date(user.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            />
          </div>
        </Card>

        {/* Actions */}
        <Card className="bg-gray-900 border-gray-800 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Actions</h2>
          <Button
            onClick={handleChangeRole}
            disabled={changeRole.isPending}
            className="w-full justify-start bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
          >
            <ShieldCheck size={14} className="mr-2 text-blue-400" />
            Changer le rôle plateforme
          </Button>
          <Button
            onClick={handleSuspend}
            disabled={suspendUser.isPending}
            className={`w-full justify-start border ${
              user.suspendedAt
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
            }`}
          >
            <Ban size={14} className="mr-2" />
            {user.suspendedAt ? 'Réactiver le compte' : 'Suspendre le compte'}
          </Button>
          <Button
            onClick={handleImpersonate}
            disabled={impersonate.isPending || !!user.suspendedAt}
            className="w-full justify-start bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20"
          >
            <Copy size={14} className="mr-2" />
            {impersonate.isPending ? 'Génération...' : 'Copier le token d\'impersonation (1h)'}
          </Button>
        </Card>
      </div>

      {/* Organisations */}
      {user.orgs.length > 0 && (
        <Card className="bg-gray-900 border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
            Organisations ({user.orgs.length})
          </h2>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="pb-2 text-xs text-gray-500">Nom</th>
                <th className="pb-2 text-xs text-gray-500">ID</th>
                <th className="pb-2 text-xs text-gray-500">Rôle</th>
              </tr>
            </thead>
            <tbody>
              {user.orgs.map((org) => (
                <tr key={org.id} className="border-b border-gray-800/50">
                  <td className="py-2.5 text-gray-200">{org.name}</td>
                  <td className="py-2.5 font-mono text-xs text-gray-400">{org.id}</td>
                  <td className="py-2.5">
                    <OrgRoleBadge role={org.orgRole} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-200 text-right">{value}</span>
    </div>
  );
}
