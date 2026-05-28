// AdminOverviewPage — métriques globales de la plateforme.
// Données depuis GET /api/admin/overview. Skeleton loading.

import { Users, Building2, Server, Rocket, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAdminOverview } from '@/api/admin';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800 p-5 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-gray-700" />
            <div className="h-7 w-16 rounded bg-gray-700" />
            {sub && <div className="h-3 w-20 rounded bg-gray-800" />}
          </div>
          <div className="h-9 w-9 rounded-lg bg-gray-700" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
          <Icon size={18} className="text-emerald-400" />
        </div>
      </div>
    </Card>
  );
}

export function AdminOverviewPage() {
  const { data, isLoading } = useAdminOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Vue d'ensemble</h1>
        <p className="text-sm text-gray-400 mt-1">Métriques globales de la plateforme</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Utilisateurs"
          value={data?.users.total ?? 0}
          sub={`+${data?.users.thisMonth ?? 0} ce mois`}
          loading={isLoading}
        />
        <StatCard
          icon={Building2}
          label="Organisations"
          value={data?.orgs.total ?? 0}
          loading={isLoading}
        />
        <StatCard
          icon={Server}
          label="Serveurs"
          value={data?.servers.total ?? 0}
          sub={`${data?.servers.ready ?? 0} prêts · ${data?.servers.error ?? 0} en erreur`}
          loading={isLoading}
        />
        <StatCard
          icon={Rocket}
          label="Déploiements"
          value={data?.deployments.total ?? 0}
          sub={`${data?.deployments.running ?? 0} en cours · ${
            Math.round((data?.deployments.successRate ?? 0) * 100)
          }% succès`}
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Revenus ce mois"
          value={
            data
              ? `${data.revenue.thisMonth.toLocaleString('fr-FR')} ${data.revenue.currency}`
              : '—'
          }
          loading={isLoading}
        />
      </div>
    </div>
  );
}
