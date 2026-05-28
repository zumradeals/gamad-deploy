// AdminOrgDetailPage — détail d'une organisation (Phase 2 superadmin).
// Affiche : infos + membres + stats + changement de plan.

import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useAdminOrgDetail,
  useAdminPlans,
  useChangeOrgPlan,
} from '@/api/admin';

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-gray-900 border-gray-800 p-5">
            <div className="h-4 w-20 rounded bg-gray-700 mb-3" />
            <div className="h-8 w-16 rounded bg-gray-700" />
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const { data: org, isLoading } = useAdminOrgDetail(id ?? '');
  const { data: plans } = useAdminPlans();
  const changePlan = useChangeOrgPlan();

  if (isLoading || !org) return <PageSkeleton />;

  const handleChangePlan = () => {
    if (!selectedPlanId) return;
    changePlan.mutate(
      { id: org.id, planId: selectedPlanId },
      {
        onSuccess: ({ planName }) => {
          toast.success(`Plan changé en "${planName}"`);
          setSelectedPlanId('');
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/orgs')}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 px-2"
        >
          <ArrowLeft size={14} className="mr-1" />
          Retour
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white">{org.name}</h1>
          <p className="text-sm text-gray-400 font-mono">{org.slug}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Projets" value={org.stats.projectsCount} />
        <StatCard label="Serveurs" value={org.stats.serversCount} />
        <StatCard label="Déploiements" value={org.stats.deploymentsCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Infos */}
        <Card className="bg-gray-900 border-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Informations</h2>
          <div className="space-y-3">
            <InfoRow label="ID" value={<span className="font-mono text-xs text-gray-300">{org.id}</span>} />
            <InfoRow label="Nom" value={org.name} />
            <InfoRow label="Slug" value={<span className="font-mono text-xs">{org.slug}</span>} />
            <InfoRow
              label="Plan actuel"
              value={
                org.plan ? (
                  <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
                    {org.plan.name}
                  </span>
                ) : (
                  <span className="text-gray-500">Aucun plan</span>
                )
              }
            />
          </div>

          {/* Changement de plan */}
          <div className="pt-3 border-t border-gray-800 space-y-2">
            <p className="text-xs font-medium text-gray-400">Changer de plan</p>
            <div className="flex gap-2">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Choisir un plan...</option>
                {(plans ?? [])
                  .filter((p) => p.isActive && p.id !== org.plan?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.priceAmount.toLocaleString('fr-FR')} {p.currency}/mois
                    </option>
                  ))}
              </select>
              <Button
                onClick={handleChangePlan}
                disabled={!selectedPlanId || changePlan.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {changePlan.isPending ? 'Enregistrement...' : 'Appliquer'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Membres */}
        <Card className="bg-gray-900 border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
            Membres ({org.members.length})
          </h2>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800 sticky top-0 bg-gray-900">
                <tr className="text-left">
                  <th className="pb-2 text-xs text-gray-500">Email</th>
                  <th className="pb-2 text-xs text-gray-500">Nom</th>
                  <th className="pb-2 text-xs text-gray-500">Rôle</th>
                </tr>
              </thead>
              <tbody>
                {org.members.map((m) => (
                  <tr key={m.userId} className="border-b border-gray-800/50">
                    <td className="py-2.5 text-gray-300 text-xs font-mono">{m.email}</td>
                    <td className="py-2.5 text-gray-400 text-xs">{m.fullName ?? '—'}</td>
                    <td className="py-2.5">
                      <OrgRoleBadge role={m.orgRole} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-gray-900 border-gray-800 p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </Card>
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
