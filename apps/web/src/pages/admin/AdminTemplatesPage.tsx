// AdminTemplatesPage — gestion des templates marketplace (Phase 2 superadmin).
// Tableau avec niveaux colorés + actions de promotion/rétrogradation.

import { toast } from 'sonner';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminTemplates, useChangeTemplateStatus, type AdminTemplateSummary } from '@/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_ORDER = ['draft', 'valid', 'certified'] as const;
type Level = typeof LEVEL_ORDER[number];

function LevelBadge({ level }: { level: Level }) {
  const variants: Record<Level, string> = {
    draft: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
    valid: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    certified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${variants[level]}`}>
      {level}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${55 + (i * 21) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Ligne d'action ────────────────────────────────────────────────────────────

function TemplateRow({ template }: { template: AdminTemplateSummary }) {
  const changeStatus = useChangeTemplateStatus();
  const currentIdx = LEVEL_ORDER.indexOf(template.level as Level);

  const canPromote = currentIdx < LEVEL_ORDER.length - 1;
  const canDemote = currentIdx > 0;

  const handlePromote = () => {
    const next = LEVEL_ORDER[currentIdx + 1];
    if (!next) return;
    changeStatus.mutate(
      { id: template.id, status: next },
      {
        onSuccess: () => toast.success(`"${template.name}" promu en "${next}"`),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const handleDemote = () => {
    const prev = LEVEL_ORDER[currentIdx - 1];
    if (!prev) return;
    if (!window.confirm(`Rétrograder "${template.name}" vers "${prev}" ?`)) return;
    changeStatus.mutate(
      { id: template.id, status: prev },
      {
        onSuccess: () => toast.success(`"${template.name}" rétrogradé en "${prev}"`),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
      <td className="px-4 py-3 text-gray-200 font-medium">{template.name}</td>
      <td className="px-4 py-3">
        <LevelBadge level={template.level as Level} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 font-mono">
        {template.authorEmail ?? '—'}
      </td>
      <td className="px-4 py-3 text-gray-400 text-center">{template.usageCount}</td>
      <td className="px-4 py-3 text-gray-400 text-xs">
        {new Date(template.createdAt).toLocaleDateString('fr-FR')}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {canPromote && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePromote}
              disabled={changeStatus.isPending}
              className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20"
              title={`Promouvoir → ${LEVEL_ORDER[currentIdx + 1]}`}
            >
              <ArrowUp size={13} />
            </Button>
          )}
          {canDemote && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDemote}
              disabled={changeStatus.isPending}
              className="h-7 w-7 p-0 text-orange-400 hover:text-orange-300 hover:bg-orange-900/20"
              title={`Rétrograder → ${LEVEL_ORDER[currentIdx - 1]}`}
            >
              <ArrowDown size={13} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminTemplatesPage() {
  const { data: templates, isLoading } = useAdminTemplates();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Templates Marketplace</h1>
        <p className="text-sm text-gray-400 mt-1">
          Modération des templates (draft → valid → certified)
        </p>
      </div>

      {/* Légende niveaux */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-500" />
          draft — brouillon non publié
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          valid — validé pour le marketplace
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          certified — certifié GAMAD
        </span>
      </div>

      {/* Table */}
      <Card className="bg-gray-900 border-gray-800 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Nom</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Niveau</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Auteur</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Usages</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Créé le</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : (templates ?? []).length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500 text-sm">
                        Aucun template sur la plateforme
                      </td>
                    </tr>
                  )
                  : (templates ?? []).map((t) => (
                    <TemplateRow key={t.id} template={t} />
                  ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
