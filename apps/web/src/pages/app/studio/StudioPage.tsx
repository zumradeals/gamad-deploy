import { Link } from 'react-router-dom';
import { Plus, Loader2, FlaskConical, Layers, CheckCircle2, Clock, XCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useBlueprints,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_CLASSES,
  type BlueprintStatus,
  type TemplateCategory,
} from '@/api/studio';

function StatusBadge({ status }: { status: BlueprintStatus }) {
  const icons: Record<BlueprintStatus, React.ElementType> = {
    draft:        Clock,
    submitted:    Send,
    under_review: Clock,
    certified:    CheckCircle2,
    rejected:     XCircle,
  };
  const Icon = icons[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLASSES[status])}>
      <Icon size={11} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StudioPage() {
  const { data: blueprints, isLoading } = useBlueprints();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-[--text]">Studio</h1>
          <p className="text-sm text-[--text-muted] mt-0.5">
            Créez et soumettez des templates de déploiement pour votre organisation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/app/studio/reference">
            <Button variant="outline" className="gap-2">
              <Layers size={15} />
              Templates de référence
            </Button>
          </Link>
          <Link to="/app/studio/new">
            <Button className="gap-2">
              <Plus size={15} />
              Nouveau blueprint
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center">
          <Loader2 size={20} className="animate-spin mx-auto text-[--text-muted]" />
        </div>
      ) : (blueprints?.length ?? 0) === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3">
          {blueprints!.map((bp) => (
            <Link
              key={bp.id}
              to={`/app/studio/${bp.id}`}
              className="group block rounded-lg border border-[--border] bg-[--surface] px-5 py-4 hover:border-[--accent] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[--text] group-hover:text-[--accent] transition-colors truncate">
                      {bp.name}
                    </p>
                    {bp.isComposed && (
                      <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        Composé
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[--text-muted] mt-0.5 truncate">
                    {bp.description || 'Aucune description'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {bp.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded px-1.5 py-0.5 bg-[rgba(16,185,129,0.08)] text-[--accent] text-[10px] font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={bp.status} />
                  <span className="text-xs text-[--text-muted]">
                    {CATEGORY_LABELS[bp.category as TemplateCategory] ?? bp.category}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[--border] p-12 text-center">
      <FlaskConical size={36} className="mx-auto mb-4 text-[--text-muted] opacity-30" />
      <p className="font-medium text-[--text]">Aucun blueprint</p>
      <p className="text-sm text-[--text-muted] mt-1 max-w-sm mx-auto">
        Créez votre premier blueprint pour concevoir un template de déploiement personnalisé.
      </p>
      <div className="flex justify-center gap-2 mt-4">
        <Link to="/app/studio/reference">
          <Button variant="outline" size="sm" className="gap-2">
            <Layers size={13} /> Voir les références
          </Button>
        </Link>
        <Link to="/app/studio/new">
          <Button size="sm" className="gap-2">
            <Plus size={13} /> Créer un blueprint
          </Button>
        </Link>
      </div>
    </div>
  );
}
