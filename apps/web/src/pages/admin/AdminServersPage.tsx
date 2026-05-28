// AdminServersPage — liste des serveurs/agents cross-tenant (Phase 3 superadmin).
// Pas de pagination. Actualisation toutes les 30s (refetchInterval). Alerte STALE.

import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAdminServers, type AdminServerSummary } from '@/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

type ServerStatus = AdminServerSummary['status'];

const SERVER_STATUS_LABELS: Record<ServerStatus, string> = {
  provisioning: 'Provisioning',
  installing: 'Installation',
  ready: 'Prêt',
  error: 'Erreur',
  destroyed: 'Détruit',
};

const SERVER_STATUS_CLASSES: Record<ServerStatus, string> = {
  provisioning: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  installing: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  error: 'bg-red-500/15 text-red-400 border-red-500/20',
  destroyed: 'bg-gray-500/15 text-gray-500 border-gray-500/20',
};

function ServerStatusBadge({ status, isStale }: { status: ServerStatus; isStale: boolean }) {
  if (isStale) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
        <AlertTriangle size={9} />
        STALE
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SERVER_STATUS_CLASSES[status]}`}>
      {SERVER_STATUS_LABELS[status]}
    </span>
  );
}

/** Formate une date en "il y a X min" ou date locale si plus ancien */
function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Jamais';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return new Date(lastSeenAt).toLocaleDateString('fr-FR');
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${50 + (i * 11) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminServersPage() {
  const { data, isLoading } = useAdminServers();

  const servers = data?.data ?? [];
  const staleCount = servers.filter((s) => s.isStale).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Serveurs & Agents</h1>
          <p className="text-sm text-gray-400 mt-1">
            Vue globale des VPS et agents cross-tenant. Actualisation toutes les 30s.
          </p>
        </div>
        {staleCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-1.5">
            <AlertTriangle size={13} className="text-red-400" />
            <span className="text-xs text-red-400 font-medium">
              {staleCount} agent{staleCount > 1 ? 's' : ''} inactif{staleCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <Card className="bg-gray-900 border-gray-800 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Nom</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Organisation</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Host</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Port</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Version agent</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Dernière activité</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Projets</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : servers.length === 0
                ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                        Aucun serveur enregistré.
                      </td>
                    </tr>
                  )
                : servers.map((server) => (
                    <tr
                      key={server.id}
                      className={`border-b border-gray-800/50 transition-colors ${server.isStale ? 'bg-red-950/10' : 'hover:bg-gray-800/30'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {server.isStale && (
                            <AlertTriangle size={12} className="text-red-400 shrink-0" />
                          )}
                          <span className="text-gray-200 font-medium">{server.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{server.orgName}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{server.host}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{server.agentPort}</td>
                      <td className="px-4 py-3">
                        <ServerStatusBadge status={server.status} isStale={server.isStale} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {server.agentVersion ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={server.isStale ? 'text-red-400' : 'text-gray-400'}>
                          {formatLastSeen(server.lastSeenAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-center text-xs">
                        {server.projectsCount}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            {isLoading ? '…' : `${servers.length} serveur${servers.length > 1 ? 's' : ''} total`}
          </p>
        </div>
      </Card>
    </div>
  );
}
