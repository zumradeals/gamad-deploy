import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';
import { useBillingInfo, useTransactions } from '@/api/billing';
import { cn } from '@/lib/utils';

const STATUS_CLASSES: Record<'success' | 'failed' | 'pending', string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-red-600 dark:text-red-400',
  pending: 'text-amber-600 dark:text-amber-400',
};

export function BillingPage() {
  const { t } = useTranslation('billing');
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { data: billing, isLoading: billingLoading } = useBillingInfo(currentOrgId);
  const [page, setPage] = useState(1);
  const { data: txData, isLoading: txLoading } = useTransactions(currentOrgId, page);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-display text-xl font-bold text-[--text]">{t('title')}</h1>

      {/* Current plan */}
      <section className="rounded-lg border border-[--border] bg-[--surface] p-6 space-y-4">
        <h2 className="font-semibold text-sm text-[--text]">{t('plan.current')}</h2>
        {billingLoading ? (
          <Loader2 size={18} className="animate-spin text-[--text-muted]" />
        ) : billing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-2xl font-bold text-[--text]">
                  {t(`plan.${billing.plan}`)}
                </p>
                <p className={cn('text-xs mt-0.5 font-medium',
                  billing.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' :
                  billing.status === 'past_due' ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400',
                )}>
                  {t(`plan.status.${billing.status}`)}
                </p>
                {billing.renewsAt && (
                  <p className="text-xs text-[--text-muted] mt-0.5">
                    {t('plan.renews')} {new Date(billing.renewsAt).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
              <Link to="/app/billing/upgrade">
                <Button variant="outline" size="sm">{t('plan.upgrade')}</Button>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[--border]">
              {(
                [
                  { labelKey: 'plan.limits.projects', value: billing.limits.projects },
                  { labelKey: 'plan.limits.servers', value: billing.limits.servers },
                  { labelKey: 'plan.limits.deployments', value: billing.limits.deploymentsPerMonth },
                ] as const
              ).map(({ labelKey, value }) => (
                <div key={labelKey} className="text-center">
                  <p className="font-bold text-[--text]">
                    {value === null ? t('plan.unlimited') : value}
                  </p>
                  <p className="text-xs text-[--text-muted] mt-0.5">{t(labelKey)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Transactions */}
      <section className="rounded-lg border border-[--border] bg-[--surface]">
        <div className="px-5 py-4 border-b border-[--border]">
          <h2 className="font-semibold text-sm text-[--text]">{t('transactions.title')}</h2>
        </div>
        {txLoading ? (
          <div className="p-8 text-center">
            <Loader2 size={18} className="animate-spin mx-auto text-[--text-muted]" />
          </div>
        ) : (txData?.items.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-sm text-[--text-muted]">{t('transactions.empty')}</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--border]">
                  {(['transactions.col.date', 'transactions.col.description', 'transactions.col.amount', 'transactions.col.status'] as const).map((col, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-medium text-[--text-muted]">
                      {t(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {txData?.items.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 text-xs text-[--text-muted]">
                      {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-[--text]">{tx.description}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--text]">
                      {(tx.amount / 100).toLocaleString('fr-FR')} {tx.currency}
                    </td>
                    <td className={cn('px-4 py-3 text-xs font-medium', STATUS_CLASSES[tx.status])}>
                      {t(`transactions.status.${tx.status}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            {(txData?.pages ?? 1) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[--border]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={13} />
                  {t('transactions.previous')}
                </Button>
                <span className="text-xs text-[--text-muted]">{page} / {txData?.pages}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={page === (txData?.pages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('transactions.next')}
                  <ChevronRight size={13} />
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
