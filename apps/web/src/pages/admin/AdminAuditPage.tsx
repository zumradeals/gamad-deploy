// AdminAuditPage — audit global des transitions d'état (Phase 3 superadmin).
// Table paginée. Filtres : orgId, plage de dates. Bouton Export CSV.

import { useState } from 'react';
import { Download, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminAudit, useAdminOrgs, exportAuditCsv } from '@/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Tronque un message à n caractères */
function truncate(str: string | null | undefined, n: number): string {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${50 + (i * 13) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [orgId, setOrgId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useAdminAudit({ page, limit: 50, orgId, from, to });
  const { data: orgs } = useAdminOrgs({ limit: 100 });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  const handleOrgChange = (val: string) => {
    setOrgId(val);
    setPage(1);
  };

  const handleFromChange = (val: string) => {
    setFrom(val);
    setPage(1);
  };

  const handleToChange = (val: string) => {
    setTo(val);
    setPage(1);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params: Parameters<typeof exportAuditCsv>[0] = {};
      if (orgId) params.orgId = orgId;
      if (from) params.from = from;
      if (to) params.to = to;
      await exportAuditCsv(params);
      toast.success('Export CSV téléchargé');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export échoué');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Audit global</h1>
          <p className="text-sm text-gray-400 mt-1">
            Transitions d'état des déploiements — INSERT-only (INV-04)
          </p>
        </div>
        <Button
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
        >
          <Download size={14} />
          {isExporting ? 'Export…' : 'Exporter CSV'}
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap items-end">
        {/* Filtre organisation */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Organisation</label>
          <div className="relative">
            <select
              value={orgId}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="appearance-none rounded-md border border-gray-700 bg-gray-900 pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer min-w-[180px]"
            >
              <option value="">Toutes les orgs</option>
              {(orgs?.data ?? []).map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Plage de dates */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Depuis</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
            className="bg-gray-900 border-gray-700 text-white focus:border-emerald-500 w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Jusqu'au</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => handleToChange(e.target.value)}
            className="bg-gray-900 border-gray-700 text-white focus:border-emerald-500 w-40"
          />
        </div>

        {(orgId || from || to) && (
          <Button
            variant="outline"
            onClick={() => { setOrgId(''); setFrom(''); setTo(''); setPage(1); }}
            className="border-gray-700 text-gray-400 hover:bg-gray-800 text-xs"
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="bg-gray-900 border-gray-800 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Projet</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Organisation</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Transition</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Message</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(10)].map((_, i) => <SkeletonRow key={i} />)
                : (data?.data ?? []).length === 0
                ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                        Aucun événement d'audit.
                      </td>
                    </tr>
                  )
                : (data?.data ?? []).map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-200 font-medium">{entry.projectName}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{entry.orgName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-gray-500 bg-gray-800 rounded px-1.5 py-0.5">
                            {entry.fromState ?? 'début'}
                          </span>
                          <ChevronRight size={11} className="text-gray-600" />
                          <span className="text-gray-200 bg-gray-800 rounded px-1.5 py-0.5 font-medium">
                            {entry.toState}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs" title={entry.reason ?? ''}>
                        {truncate(entry.reason, 60)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(entry.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            {data ? `${data.total} événement${data.total > 1 ? 's' : ''}` : '—'}
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
    </div>
  );
}
