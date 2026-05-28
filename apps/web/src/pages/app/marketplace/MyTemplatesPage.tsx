import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Trash2, Pencil, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useOrgTemplates, useUpdateOrgTemplate, useDeleteOrgTemplate } from '@/api/marketplace';
import type { OrgTemplate } from '@/api/marketplace';
import { useAuthStore } from '@/store/auth.store';

const LEVEL_CLASSES: Record<string, string> = {
  certified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  valid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const LEVEL_LABELS: Record<string, string> = {
  certified: 'Certifié',
  valid: 'Validé',
  draft: 'Brouillon',
};

function formatPrice(amount: number): string {
  return amount === 0 ? 'Gratuit' : `${amount.toLocaleString('fr-FR')} XOF`;
}

export function MyTemplatesPage() {
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { data: templates, isLoading } = useOrgTemplates(currentOrgId);
  const updateTemplate = useUpdateOrgTemplate(currentOrgId);
  const deleteTemplate = useDeleteOrgTemplate(currentOrgId);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleTogglePublish = (t: OrgTemplate) => {
    if (!t.isPublished && t.marketplaceLevel !== 'certified') {
      toast.error('Un template doit être certifié avant d\'être publié.');
      return;
    }
    updateTemplate.mutate(
      { id: t.id, isPublished: !t.isPublished },
      {
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.'),
      },
    );
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteTemplate.mutate(id, {
      onSuccess: () => {
        toast.success('Template supprimé.');
        setDeletingId(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
        setDeletingId(null);
      },
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-[--text]">Mes templates</h1>
          <p className="text-sm text-[--text-muted] mt-0.5">
            Templates soumis par votre organisation.
          </p>
        </div>
        <Link to="/app/orgs/templates/new">
          <Button className="gap-2">
            <Plus size={15} />
            Soumettre un template
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border border-[--border] bg-[--surface]">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 size={20} className="animate-spin mx-auto text-[--text-muted]" />
          </div>
        ) : (templates?.length ?? 0) === 0 ? (
          <div className="p-12 text-center">
            <FileCode size={32} className="mx-auto mb-3 text-[--text-muted] opacity-40" />
            <p className="font-medium text-[--text]">Aucun template soumis</p>
            <p className="text-sm text-[--text-muted] mt-1">
              Soumettez votre premier template pour le partager dans le marketplace.
            </p>
            <Link to="/app/orgs/templates/new" className="mt-4 inline-block">
              <Button variant="outline" size="sm" className="gap-2">
                <Plus size={13} /> Soumettre
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--border]">
                  {(['Nom', 'Niveau', 'Prix', 'Publié', 'Usages', 'Actions'] as const).map((col, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-medium text-[--text-muted]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {templates?.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[--text]">{t.name}</p>
                      <p className="text-xs text-[--text-muted] font-mono">{t.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          LEVEL_CLASSES[t.marketplaceLevel] ?? LEVEL_CLASSES.draft,
                        )}
                      >
                        {LEVEL_LABELS[t.marketplaceLevel] ?? t.marketplaceLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[--text]">
                      {formatPrice(t.priceAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={t.isPublished}
                        onCheckedChange={() => handleTogglePublish(t)}
                        disabled={updateTemplate.isPending}
                      />
                    </td>
                    <td className="px-4 py-3 text-[--text-muted]">
                      {t.usageCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[--text-muted] hover:text-[--text]"
                          title="Modifier"
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[--text-muted] hover:text-red-500"
                          title="Supprimer"
                          disabled={deletingId === t.id}
                          onClick={() => handleDelete(t.id)}
                        >
                          {deletingId === t.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
