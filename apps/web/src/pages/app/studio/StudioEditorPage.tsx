import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Save, Send, History, Layers, Trash2,
  CheckCircle2, XCircle, Clock, AlertTriangle, Sparkles, Github,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  useBlueprint,
  useUpdateBlueprint,
  useSubmitBlueprint,
  useAddComponent,
  useRemoveComponent,
  useReferenceTemplates,
  useGenerateTemplate,
  usePublishBlueprint,
  STATUS_LABELS,
  STATUS_CLASSES,
  CATEGORY_LABELS,
  type BlueprintStatus,
  type TemplateCategory,
} from '@/api/studio';

type Tab = 'editor' | 'compose' | 'history';

function StatusBadge({ status }: { status: BlueprintStatus }) {
  const icons: Record<BlueprintStatus, React.ElementType> = {
    draft: Clock, submitted: Send, under_review: Clock,
    certified: CheckCircle2, rejected: XCircle,
  };
  const Icon = icons[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CLASSES[status])}>
      <Icon size={11} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StudioEditorPage() {
  const { id } = useParams<{ id: string }>();

  const { data: bp, isLoading } = useBlueprint(id);
  const update = useUpdateBlueprint(id!);
  const submit = useSubmitBlueprint(id!);
  const addComponent = useAddComponent(id!);
  const removeComponent = useRemoveComponent(id!);
  const { data: refTemplates } = useReferenceTemplates();

  const generate = useGenerateTemplate();
  const publish = usePublishBlueprint(id!);

  const [tab, setTab] = useState<Tab>('editor');
  const [contractContent, setContractContent] = useState('');
  const [contractError, setContractError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    if (bp?.latestRevision?.contractContent) {
      setContractContent(bp.latestRevision.contractContent);
      setIsDirty(false);
    }
  }, [bp?.latestRevision?.contractContent]);

  const handleContractChange = (v: string) => {
    setContractContent(v);
    setIsDirty(true);
    try {
      JSON.parse(v);
      setContractError(null);
    } catch {
      setContractError('JSON invalide');
    }
  };

  const handleSave = () => {
    if (contractError) { toast.error('Le gamad.json contient des erreurs JSON.'); return; }
    update.mutate(
      { contractContent },
      {
        onSuccess: () => {
          toast.success('Révision sauvegardée.');
          setIsDirty(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur.'),
      },
    );
  };

  const handleSubmit = () => {
    if (isDirty) { toast.error('Sauvegardez d\'abord vos modifications.'); return; }
    if (!bp?.latestRevisionId) { toast.error('Aucune révision à soumettre.'); return; }
    submit.mutate(undefined, {
      onSuccess: () => toast.success('Blueprint soumis pour certification.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur.'),
    });
  };

  const handleAddComponent = (templateId: string) => {
    const nextOrder = (bp?.components.length ?? 0);
    addComponent.mutate(
      { componentTemplateId: templateId, order: nextOrder },
      {
        onSuccess: () => toast.success('Composant ajouté.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur.'),
      },
    );
  };

  const handleGenerate = () => {
    if (!aiPrompt.trim()) { toast.error('Décrivez l\'application à générer.'); return; }
    const genParams = {
      description: aiPrompt,
      category: (bp?.category ?? 'web_app') as TemplateCategory,
      ...(id ? { blueprintId: id } : {}),
    };
    generate.mutate(
      genParams,
      {
        onSuccess: (res) => {
          setContractContent(res.contractContent);
          setIsDirty(true);
          setContractError(null);
          setShowAiPanel(false);
          setAiPrompt('');
          toast.success(`gamad.json généré (${res.tokensUsed} tokens). Pensez à sauvegarder.`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur de génération.'),
      },
    );
  };

  const handleRemoveComponent = (componentId: string) => {
    removeComponent.mutate(componentId, {
      onSuccess: () => toast.success('Composant retiré.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur.'),
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Loader2 size={20} className="animate-spin mx-auto text-[--text-muted]" />
      </div>
    );
  }

  if (!bp) {
    return (
      <div className="p-12 text-center">
        <p className="text-[--text-muted]">Blueprint introuvable.</p>
        <Link to="/app/studio"><Button variant="outline" className="mt-4">Retour au Studio</Button></Link>
      </div>
    );
  }

  const isCertified = bp.status === 'certified';
  const canSubmit = (bp.status === 'draft' || bp.status === 'rejected') && !!bp.latestRevisionId;

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/app/studio">
            <Button variant="ghost" size="sm" className="gap-1 text-[--text-muted] shrink-0">
              <ArrowLeft size={14} />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-[--text] truncate">{bp.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={bp.status} />
              <span className="text-xs text-[--text-muted]">
                {CATEGORY_LABELS[bp.category as TemplateCategory] ?? bp.category}
              </span>
              {bp.revisions.length > 0 && (
                <span className="text-xs text-[--text-muted]">
                  v{bp.revisions[0]?.version ?? 1}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isCertified && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={!isDirty || update.isPending || !!contractError}
            >
              {update.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Sauvegarder
            </Button>
          )}
          {canSubmit && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSubmit}
              disabled={submit.isPending || isDirty}
            >
              {submit.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Soumettre
            </Button>
          )}
          {isCertified && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                publish.mutate(undefined, {
                  onSuccess: (res) => {
                    toast.success(
                      res.gamadForkUrl
                        ? `Publié sur GitHub + forké dans le catalogue GAMAD.`
                        : `Publié sur GitHub : ${res.userRepoUrl}`,
                    );
                  },
                  onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur de publication.'),
                })
              }
              disabled={publish.isPending}
            >
              {publish.isPending ? <Loader2 size={13} className="animate-spin" /> : <Github size={13} />}
              {bp.repoUrl ? 'Mettre à jour GitHub' : 'Publier sur GitHub'}
            </Button>
          )}
        </div>
      </div>

      {/* Avertissement si rejeté */}
      {bp.status === 'rejected' && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 px-4 py-3">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">
            Ce blueprint a été rejeté. Modifiez le gamad.json et soumettez à nouveau.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[--border]">
        {([
          ['editor', 'Éditeur'],
          ['compose', 'Composition'],
          ['history', 'Historique'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-[--accent] text-[--accent]'
                : 'border-transparent text-[--text-muted] hover:text-[--text]',
            )}
          >
            {t === 'compose' && <Layers size={13} className="inline mr-1.5" />}
            {t === 'history' && <History size={13} className="inline mr-1.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* Tab : Éditeur */}
      {tab === 'editor' && (
        <div className="space-y-3">
          {bp.description && (
            <p className="text-sm text-[--text-muted]">{bp.description}</p>
          )}
          {bp.repoUrl && (
            <a
              href={bp.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[--text-muted] hover:text-[--text] underline-offset-2 hover:underline"
            >
              <Github size={11} />
              {bp.repoUrl}
            </a>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[--text-muted]">
              Spec C-02 — modifiez le contrat gamad.json. Chaque sauvegarde crée une révision immuable.
            </p>
            <div className="flex items-center gap-2">
              {!isCertified && (
                <button
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                >
                  <Sparkles size={11} />
                  Générer avec l'IA
                </button>
              )}
              {contractError ? (
                <span className="text-xs text-red-500 font-medium">{contractError}</span>
              ) : (
                <span className="text-xs text-emerald-500 font-medium">JSON valide</span>
              )}
            </div>
          </div>

          {/* Panneau IA */}
          {showAiPanel && !isCertified && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-900/10 dark:border-purple-800 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-purple-500" />
                <span className="text-sm font-medium text-[--text]">Générer un gamad.json avec l'IA</span>
                <span className="text-xs text-[--text-muted]">(Abonnement actif requis)</span>
              </div>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                placeholder="Ex : API Node.js avec PostgreSQL et Redis, exposée sur le port 3000, avec un worker BullMQ..."
                className="w-full rounded-md border border-purple-300 dark:border-purple-700 px-3 py-2 text-sm bg-white dark:bg-[--bg] text-[--text] focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleGenerate}
                  disabled={generate.isPending || !aiPrompt.trim()}
                >
                  {generate.isPending
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Sparkles size={13} />}
                  {generate.isPending ? 'Génération…' : 'Générer'}
                </Button>
                <button
                  onClick={() => { setShowAiPanel(false); setAiPrompt(''); }}
                  className="text-xs text-[--text-muted] hover:text-[--text]"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          <textarea
            value={contractContent}
            onChange={(e) => handleContractChange(e.target.value)}
            disabled={isCertified}
            rows={28}
            spellCheck={false}
            className={cn(
              'w-full rounded-md border px-3 py-2.5 text-xs font-mono bg-[--bg] text-[--text]',
              'focus:outline-none focus:ring-2 resize-y',
              contractError
                ? 'border-red-400 focus:ring-red-400'
                : 'border-[--border] focus:ring-[--accent]',
              isCertified && 'opacity-60 cursor-not-allowed',
            )}
          />
          {isCertified && (
            <p className="text-xs text-[--text-muted]">
              Ce blueprint est certifié — il ne peut plus être modifié.
            </p>
          )}
        </div>
      )}

      {/* Tab : Composition */}
      {tab === 'compose' && (
        <div className="space-y-5">
          {/* Composants actuels */}
          <div>
            <h3 className="text-sm font-medium text-[--text] mb-3">
              Composants ({bp.components.length})
            </h3>
            {bp.components.length === 0 ? (
              <p className="text-sm text-[--text-muted]">
                Aucun composant. Ajoutez des templates de référence ci-dessous.
              </p>
            ) : (
              <div className="space-y-2">
                {bp.components
                  .sort((a, b) => a.order - b.order)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-[--border] bg-[--surface] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[--text]">{c.name}</p>
                        <p className="text-xs text-[--text-muted] font-mono">{c.slug}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[--text-muted]">
                          {c.priceAmount === 0 ? 'Gratuit' : `${c.priceAmount.toLocaleString('fr-FR')} XOF`}
                        </span>
                        {!isCertified && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-[--text-muted] hover:text-red-500"
                            onClick={() => handleRemoveComponent(c.id)}
                            disabled={removeComponent.isPending}
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Templates de référence disponibles */}
          {!isCertified && (
            <div>
              <h3 className="text-sm font-medium text-[--text] mb-3">
                Templates de référence GAMAD
              </h3>
              <div className="grid gap-2">
                {(refTemplates ?? []).map((t) => {
                  const alreadyAdded = bp.components.some((c) => c.componentTemplateId === t.id);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border border-[--border] bg-[--surface] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[--text]">{t.name}</p>
                        <p className="text-xs text-[--text-muted] truncate">{t.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded px-1.5 py-0.5 bg-[rgba(16,185,129,0.08)] text-[--accent] text-[10px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className="text-xs text-[--text-muted]">
                          {t.priceAmount === 0 ? 'Gratuit' : `${t.priceAmount.toLocaleString('fr-FR')} XOF`}
                        </span>
                        <Button
                          size="sm"
                          variant={alreadyAdded ? 'outline' : 'default'}
                          disabled={alreadyAdded || addComponent.isPending}
                          onClick={() => handleAddComponent(t.id)}
                        >
                          {alreadyAdded ? 'Ajouté' : 'Ajouter'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab : Historique */}
      {tab === 'history' && (
        <div className="space-y-3">
          <p className="text-sm text-[--text-muted]">
            Chaque sauvegarde crée une révision immuable (INV-04). Le hash SHA-256 prouve l'intégrité.
          </p>
          {bp.revisions.length === 0 ? (
            <p className="text-sm text-[--text-muted]">Aucune révision pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {bp.revisions.map((r, i) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-[--border] bg-[--surface] px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[--text]">v{r.version}</span>
                      {i === 0 && (
                        <span className="rounded-full bg-[rgba(16,185,129,0.1)] px-1.5 py-0.5 text-[10px] font-medium text-[--accent]">
                          Actuelle
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-[--text-muted] mt-0.5">{r.contentHash}</p>
                  </div>
                  <span className="text-xs text-[--text-muted]">
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
