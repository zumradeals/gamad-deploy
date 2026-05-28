// AdminBillingPage — transactions de facturation cross-tenant (Phase 3 superadmin).
// 4 cartes résumé + table paginée. Filtre statut.

import { useState } from 'react';
import { ChevronDown, TrendingUp, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminBilling, type AdminBillingTransaction } from '@/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formate un montant XOF */
function formatXOF(amount: number): string {
  return new Intl.NumberFormat('fr-CI', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount);
}

type TxStatus = AdminBillingTransaction['status'];
type TxType = AdminBillingTransaction['type'];

const STATUS_LABELS: Record<TxStatus, string> = {
  pending: 'En attente',
  success: 'Réussi',
  failed: 'Échoué',
};

const STATUS_CLASSES: Record<TxStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const TYPE_LABELS: Record<TxType, string> = {
  subscription: 'Abonnement',
  template_purchase: 'Template',
  credits: 'Crédits',
};

const TYPE_CLASSES: Record<TxType, string> = {
  subscription: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  template_purchase: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  credits: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
};

function TxStatusBadge({ status }: { status: TxStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function TxTypeBadge({ type }: { type: TxType }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_CLASSES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

// ── Cartes résumé ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  colorClass: string;
}

function SummaryCard({ label, value, icon, colorClass }: SummaryCardProps) {
  return (
    <Card className="bg-gray-900 border-gray-800 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-md bg-gray-800 ${colorClass}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${50 + (i * 13) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'success', label: 'Réussi' },
  { value: 'failed', label: 'Échoué' },
];

export function AdminBillingPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useAdminBilling({ page, limit: 20, status });

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const summary = data?.summary;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Facturation</h1>
        <p className="text-sm text-gray-400 mt-1">Transactions de paiement globales cross-tenant</p>
      </div>

      {/* 4 cartes résumé */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Revenu total"
          value={summary ? formatXOF(summary.totalRevenue) : '—'}
          icon={<TrendingUp size={16} />}
          colorClass="text-emerald-400"
        />
        <SummaryCard
          label="Ce mois"
          value={summary ? formatXOF(summary.thisMonth) : '—'}
          icon={<Calendar size={16} />}
          colorClass="text-blue-400"
        />
        <SummaryCard
          label="Transactions réussies"
          value={summary ? String(summary.successCount) : '—'}
          icon={<CheckCircle2 size={16} />}
          colorClass="text-emerald-400"
        />
        <SummaryCard
          label="Transactions échouées"
          value={summary ? String(summary.failedCount) : '—'}
          icon={<XCircle size={16} />}
          colorClass="text-red-400"
        />
      </div>

      {/* Filtre statut */}
      <div className="flex gap-2">
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
      </div>

      {/* Table */}
      <Card className="bg-gray-900 border-gray-800 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Organisation</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Montant</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Référence</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                : (data?.data ?? []).length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                        Aucune transaction trouvée.
                      </td>
                    </tr>
                  )
                : (data?.data ?? []).map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-200">{tx.orgName}</td>
                      <td className="px-4 py-3">
                        <TxTypeBadge type={tx.type} />
                      </td>
                      <td className="px-4 py-3 text-gray-200 font-medium tabular-nums">
                        {formatXOF(tx.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <TxStatusBadge status={tx.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[140px]">
                        {tx.reference}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(tx.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            {data ? `${data.total} transaction${data.total > 1 ? 's' : ''}` : '—'}
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
