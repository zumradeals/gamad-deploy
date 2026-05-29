import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Layers, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReferenceTemplates, CATEGORY_LABELS, type TemplateCategory } from '@/api/studio';

export function StudioReferencePage() {
  const { data: templates, isLoading } = useReferenceTemplates();

  const grouped = (templates ?? []).reduce<Record<string, typeof templates>>((acc, t) => {
    const cat = (t.tags.find((tag) =>
      Object.keys(CATEGORY_LABELS).includes(tag),
    ) ?? 'web_app') as TemplateCategory;
    const label = CATEGORY_LABELS[cat] ?? cat;
    (acc[label] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/studio">
          <Button variant="ghost" size="sm" className="gap-1 text-[--text-muted]">
            <ArrowLeft size={14} /> Studio
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-[--text]">Templates de référence</h1>
          <p className="text-sm text-[--text-muted] mt-0.5">
            Templates GAMAD Officiel — utilisables comme composants dans vos blueprints.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center">
          <Loader2 size={20} className="animate-spin mx-auto text-[--text-muted]" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <Layers size={14} className="text-[--accent]" />
                <h2 className="text-sm font-semibold text-[--text]">{category}</h2>
              </div>
              <div className="grid gap-3">
                {(items ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-[--border] bg-[--surface] px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[--text]">{t.name}</p>
                          {t.priceAmount > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <Lock size={10} />
                              {t.priceAmount.toLocaleString('fr-FR')} XOF
                            </span>
                          )}
                          {t.priceAmount === 0 && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Gratuit
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[--text-muted] mt-1">{t.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {t.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded px-1.5 py-0.5 bg-[rgba(16,185,129,0.08)] text-[--accent] text-[10px] font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <a
                          href={t.contractContent ? '#' : undefined}
                          onClick={(e) => {
                            if (!t.contractContent) return;
                            e.preventDefault();
                            navigator.clipboard.writeText(t.contractContent).then(() =>
                              alert('gamad.json copié dans le presse-papiers'),
                            );
                          }}
                        >
                          <Button variant="outline" size="sm" disabled={!t.contractContent}>
                            Copier gamad.json
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-[--border] px-5 py-4 text-sm text-[--text-muted]">
        <strong className="text-[--text]">Vous souhaitez contribuer ?</strong>{' '}
        Créez un blueprint dans le Studio, soumettez-le pour certification, et il pourra rejoindre le catalogue officiel.
      </div>
    </div>
  );
}
