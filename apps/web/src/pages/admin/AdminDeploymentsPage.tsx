// AdminDeploymentsPage — liste paginée des déploiements cross-tenant (Phase 3 superadmin).
// Filtres : statut, recherche projet. Clic → Dialog avec logs colorés par niveau.

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useAdminDeployments,
  useAdminDeploymentLogs,
  type AdminDeploymentSummary,
  type AdminDeploymentLog,
} from '@/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formate des secondes en "2m 34s" */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

type DeployStatus = AdminDeploymentSummary['status'];

const STATUS_LABELS: Record<DeployStatus, string> = {
  pending: 'En attente',
  running: 'En cours',
  success: 'Succès',
  failed: 'Échoué',
  rolled_back: 'Annulé',
};

const STATUS_CLASSES: Record<DeployStatus, string> = {
  pending: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  running: 'bg-blue-500/15 text-blue-400 border-blue-500/20 animate-pulse',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-400 border-red-500/20',
  rolled_back: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
};

function DeployStatusBadge({ status }: { status: DeployStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

type LogLevel = AdminDeploymentLog['level'];

const LOG_LEVEL_CLASSES: Record<LogLevel, string> = {
  info: 'text-gray-300',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-emerald-400',
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${55 + (i * 17) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Dialog Logs ───────────────────────────────────────────────────────────────

function DeploymentLogsDialog({
  deployment,
  onClose,
}: {
  deployment: AdminDeploymentSummary;
  onClose: () => void;
}) {
  const { data, isLoading } = useAdminDeploymentLogs(deployment.id);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll en bas quand les logs arrivent
  useEffect(() => {
    if (data?.logs && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data?.logs]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">
            Logs — <span className="text-emerald-400">{deployment.projectName}</span>
            <span className="ml-2 text-gray-500 text-xs font-mono">{deployment.id.slice(0, 8)}…</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 rounded bg-gray-700 animate-pulse" style={{ width: `${60 + (i * 7) % 35}%` }} />
            ))}
          </div>
        ) : (
          <pre className="overflow-y-auto max-h-[60vh] rounded-md bg-gray-950 p-4 text-xs font-mono leading-relaxed">
            {(data?.logs ?? []).length === 0 ? (
              <span className="text-gray-500">Aucun log disponible.</span>
            ) : (
              (data?.logs ?? []).map((log) => (
                <div key={log.id} className={`whitespace-pre-wrap ${LOG_LEVEL_CLASSES[log.level]}`}>
                  <span className="text-gray-600 select-none mr-2">
                    {new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                  </span>
                  <span className="font-bold mr-2">[{log.level.toUpperCase()}]</span>
                  {log.step && <span className="text-gray-400 mr-2">{log.step}</span>}
                  {log.message}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'running', label: 'En cours' },
  { value: 'success', label: 'Succès' },
  { value: 'failed', label: 'Échoué' },
  { value: 'rolled_back', label: 'Annulé' },
];

export function AdminDeploymentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDeploy, setSelectedDeploy] = useState<AdminDeploymentSummary | null>(null);

  const { data, isLoading } = useAdminDeployments({ page, limit: 20, status, search });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Déploiements</h1>
        <p className="text-sm text-gray-400 mt-1">Historique global des déploiements cross-tenant</p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {/* Filtre statut */}
        <div className="relative">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="appearance-none rounded-md border border-gray-700 bg-gray-900 pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Recherche projet */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Nom du projet..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500"
          />
        </div>
        <Button
          onClick={handleSearch}
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          Rechercher
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-gray-900 border-gray-800 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Projet</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Organisation</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Trigger</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Durée</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                : (data?.data ?? []).map((dep) => (
                    <tr
                      key={dep.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedDeploy(dep)}
                    >
                      <td className="px-4 py-3 text-gray-200 font-medium">{dep.projectName}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{dep.orgName}</td>
                      <td className="px-4 py-3">
                        <DeployStatusBadge status={dep.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs capitalize">{dep.triggerType}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDuration(dep.durationSeconds)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(dep.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            {data ? `${data.total} déploiement${data.total > 1 ? 's' : ''}` : '—'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 h-7 px-2 text-xs"
            >
              Préc.
            </Button>
            <span className="text-xs text-gray-400">{page} / {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 h-7 px-2 text-xs"
            >
              Suiv.
            </Button>
          </div>
        </div>
      </Card>

      {/* Dialog logs */}
      {selectedDeploy && (
        <DeploymentLogsDialog
          deployment={selectedDeploy}
          onClose={() => setSelectedDeploy(null)}
        />
      )}
    </div>
  );
}
