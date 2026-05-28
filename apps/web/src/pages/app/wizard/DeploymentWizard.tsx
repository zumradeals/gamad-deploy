import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useWizardStore } from '@/store/wizard.store';
import type { ProjectType } from '@/store/wizard.store';
import { useAnalyzeRepo } from '@/api/projects';
import { useNormalizePreview, useNormalizeCommit } from '@/api/normalize';
import { useGitHubStatus, useGitHubRepos, useGitHubAuthUrl, useGitHubFork } from '@/api/github';
import type { NormalizeFile } from '@/api/types';
import { useServers, useCreateServer } from '@/api/servers';
import type { ServerCreatedResult } from '@/api/types';
import { useCreateDeployment } from '@/api/deployments';
import { SecretRevealModal } from '@/components/app/SecretRevealModal';
import { buildDockerRunCommand } from '@/lib/agent';

// ── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation('wizard');
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto">
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors',
                  done && 'bg-[--accent] border-[--accent] text-white',
                  active && 'border-[--accent] text-[--accent] bg-transparent',
                  !done && !active && 'border-[--border] text-[--text-muted] bg-transparent',
                )}
              >
                {done ? <Check size={14} /> : step}
              </div>
              <span className={cn('text-[10px] hidden sm:block', active ? 'text-[--accent] font-medium' : 'text-[--text-muted]')}>
                {t(`step.${step}`)}
              </span>
            </div>
            {step < total && (
              <div className={cn('h-px w-8 sm:w-12 mx-1 mt-[-12px]', step < current ? 'bg-[--accent]' : 'bg-[--border]')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1 : Project type ─────────────────────────────────────────────────────

const TYPE_OPTIONS: Array<{ type: ProjectType; labelKey: string; descKey: string }> = [
  { type: 'git', labelKey: 'type.git', descKey: 'type.git.desc' },
  { type: 'template', labelKey: 'type.template', descKey: 'type.template.desc' },
  { type: 'lovable', labelKey: 'type.lovable', descKey: 'type.lovable.desc' },
  { type: 'bolt', labelKey: 'type.bolt', descKey: 'type.bolt.desc' },
  { type: 'replit', labelKey: 'type.replit', descKey: 'type.replit.desc' },
];

function Step1() {
  const { t } = useTranslation('wizard');
  const { projectType, setProjectType, setStep } = useWizardStore();
  const [error, setError] = useState<string | null>(null);

  const advance = () => {
    if (!projectType) { setError(t('type.required')); return; }
    setStep(2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[--text]">{t('type.title')}</h2>
        <p className="text-sm text-[--text-muted] mt-1">{t('type.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TYPE_OPTIONS.map(({ type, labelKey, descKey }) => (
          <button
            key={type}
            onClick={() => { setProjectType(type); setError(null); }}
            className={cn(
              'rounded-lg border-2 p-4 text-left transition-all',
              projectType === type
                ? 'border-[--accent] bg-[rgba(16,185,129,0.06)]'
                : 'border-[--border] hover:border-[rgba(16,185,129,0.5)]',
            )}
          >
            <p className="font-semibold text-sm text-[--text]">{t(labelKey)}</p>
            <p className="text-xs text-[--text-muted] mt-0.5">{t(descKey)}</p>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <StepFooter onNext={advance} showBack={false} />
    </div>
  );
}

// ── Step 2 : Repo ─────────────────────────────────────────────────────────────

const repoSchema = z.object({
  repoUrl: z.string().min(1, 'error.required').url('error.url'),
  branch: z.string().min(1, 'error.required'),
  gitToken: z.string().optional(),
});
type RepoForm = z.infer<typeof repoSchema>;

const ANALYZE_STEPS = [
  'analyze.step.connect',
  'analyze.step.read',
  'analyze.step.detect',
  'analyze.step.generate',
] as const;

function Step2() {
  const { t } = useTranslation(['wizard', 'common']);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { repoUrl, branch, gitToken, setRepoUrl, setBranch, setGitToken, setAnalysisResult, setStep } = useWizardStore();
  const analyze = useAnalyzeRepo(currentOrgId);
  const { data: ghStatus } = useGitHubStatus();
  const { data: ghRepos, isLoading: reposLoading } = useGitHubRepos(1, ghStatus?.connected);
  const getAuthUrl = useGitHubAuthUrl();

  const [mode, setMode] = useState<'github' | 'manual'>(ghStatus?.connected ? 'github' : 'manual');
  const [search, setSearch] = useState('');
  const [analyzeStep, setAnalyzeStep] = useState(0);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RepoForm>({
    resolver: zodResolver(repoSchema),
    defaultValues: { repoUrl, branch, gitToken },
  });

  useEffect(() => {
    if (ghStatus?.connected && mode === 'manual') setMode('github');
  }, [ghStatus?.connected]); // intentionally limited — only react to connection status changes

  useEffect(() => {
    if (!analyze.isPending) return;
    setAnalyzeStep(0);
    const id = window.setInterval(() => {
      setAnalyzeStep((prev) => Math.min(prev + 1, ANALYZE_STEPS.length - 1));
    }, 2500);
    return () => window.clearInterval(id);
  }, [analyze.isPending]);

  const onSubmit = (data: RepoForm) => {
    setRepoUrl(data.repoUrl);
    setBranch(data.branch);
    setGitToken(data.gitToken ?? '');
    analyze.mutate(
      { repoUrl: data.repoUrl, branch: data.branch, ...(data.gitToken ? { gitToken: data.gitToken } : {}) },
      {
        onSuccess: (result) => { setAnalysisResult(result); setStep(3); },
        onError: (error: Error) => {
          toast.error(error.message && error.message !== 'Internal server error'
            ? error.message
            : t('analyze.error', { ns: 'wizard' }));
        },
      },
    );
  };

  const handlePickRepo = (repo: { full_name: string; default_branch: string; html_url: string }) => {
    const url = repo.html_url;
    setValue('repoUrl', url);
    setValue('branch', repo.default_branch);
    setRepoUrl(url);
    setBranch(repo.default_branch);
  };

  const filteredRepos = (ghRepos ?? []).filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-6" noValidate>
      <h2 className="font-display text-xl font-bold text-[--text]">{t('repo.title', { ns: 'wizard' })}</h2>

      {/* GitHub / Manual toggle */}
      {ghStatus?.connected && (
        <div className="flex rounded-lg border border-[--border] overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setMode('github')}
            className={cn('flex-1 py-2 px-3 transition-colors', mode === 'github' ? 'bg-[--accent] text-white' : 'bg-[--surface] text-[--text-muted] hover:bg-[rgba(16,185,129,0.06)]')}
          >
            {t('repo.github.picker', { ns: 'wizard' })}
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={cn('flex-1 py-2 px-3 transition-colors', mode === 'manual' ? 'bg-[--accent] text-white' : 'bg-[--surface] text-[--text-muted] hover:bg-[rgba(16,185,129,0.06)]')}
          >
            {t('repo.github.manual', { ns: 'wizard' })}
          </button>
        </div>
      )}

      {/* GitHub repo picker */}
      {mode === 'github' && ghStatus?.connected && (
        <div className="space-y-3">
          <Input
            placeholder={t('repo.github.search', { ns: 'wizard' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="rounded-lg border border-[--border] bg-[--surface] divide-y divide-[--border] max-h-60 overflow-y-auto">
            {reposLoading ? (
              <div className="flex items-center gap-2 p-4 text-[--text-muted]">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-sm">{t('repo.github.loading', { ns: 'wizard' })}</span>
              </div>
            ) : filteredRepos.length === 0 ? (
              <p className="text-sm text-[--text-muted] p-4">{t('repo.github.empty', { ns: 'wizard' })}</p>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => handlePickRepo(repo)}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-[rgba(16,185,129,0.06)] transition-colors',
                    repoUrl === repo.html_url && 'bg-[rgba(16,185,129,0.08)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[--text] truncate">{repo.full_name}</span>
                    {repo.private && (
                      <span className="shrink-0 text-xs bg-[--border] text-[--text-muted] px-1.5 py-0.5 rounded">
                        {t('repo.github.private', { ns: 'wizard' })}
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-xs text-[--text-muted] mt-0.5 truncate">{repo.description}</p>
                  )}
                </button>
              ))
            )}
          </div>
          {/* Hidden URL/branch fields still need values */}
          <input type="hidden" {...register('repoUrl')} />
          <input type="hidden" {...register('branch')} />
          {errors.repoUrl && <p className="text-xs text-red-500">{t('error.required', { ns: 'common' })}</p>}
        </div>
      )}

      {/* Manual form (or GitHub not connected) */}
      {(mode === 'manual' || !ghStatus?.connected) && (
        <div className="space-y-4">
          {!ghStatus?.connected && (
            <button
              type="button"
              onClick={() => getAuthUrl.mutate(undefined, { onSuccess: ({ url }) => { window.location.href = url; } })}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[--border] px-4 py-3 text-sm text-[--text-muted] hover:border-[--accent] hover:text-[--accent] transition-colors"
            >
              <span>🔗</span>
              {t('repo.github.connect', { ns: 'wizard' })}
            </button>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="repoUrl">{t('repo.url', { ns: 'wizard' })}</Label>
            <Input id="repoUrl" placeholder={t('repo.url.placeholder', { ns: 'wizard' })} {...register('repoUrl')} />
            {errors.repoUrl && <p className="text-xs text-red-500">{t(errors.repoUrl.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="branch">{t('repo.branch', { ns: 'wizard' })}</Label>
            <Input id="branch" placeholder={t('repo.branch.placeholder', { ns: 'wizard' })} {...register('branch')} />
            {errors.branch && <p className="text-xs text-red-500">{t(errors.branch.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gitToken">{t('repo.token', { ns: 'wizard' })}</Label>
            <Input id="gitToken" type="password" placeholder={t('repo.token.placeholder', { ns: 'wizard' })} {...register('gitToken')} />
            <p className="text-xs text-[--text-muted]">{t('repo.token.hint', { ns: 'wizard' })}</p>
          </div>
        </div>
      )}

      {analyze.isPending && (
        <div className="flex items-center gap-3 rounded-lg border border-[--border] bg-[rgba(16,185,129,0.04)] p-4">
          <Loader2 size={18} className="text-[--accent] animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-[--text]">{t(ANALYZE_STEPS[analyzeStep] ?? ANALYZE_STEPS[0], { ns: 'wizard' })}</p>
            {analyzeStep === ANALYZE_STEPS.length - 1 && (
              <p className="text-xs text-[--text-muted] mt-0.5">{t('analyze.slow', { ns: 'wizard' })}</p>
            )}
          </div>
        </div>
      )}

      <StepFooter
        onNext={() => { /* submit handled by form */ }}
        submitLabel={t('repo.analyze', { ns: 'wizard' })}
        isSubmit
        isLoading={analyze.isPending}
        onBack={() => setStep(1)}
      />
    </form>
  );
}

// ── Step 3 : Preflight + Normalization Gate ───────────────────────────────────

const CONFIDENCE_CLASS: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

type NormalizePhase =
  | 'idle'          // Bouton "Prévisualiser"
  | 'previewing'    // Appel /normalize/preview en cours
  | 'preview'       // Fichiers listés, bouton "Ouvrir PR"
  | 'committing'    // Appel /normalize/commit en cours
  | 'pr_created'    // PR créée, bouton "J'ai mergé"
  | 're_analyzing'  // Re-analyse en cours
  | 'verified'      // Normalisé, "Suivant" débloqué
  | 'forking';      // Fork en cours (repo non possédé par l'utilisateur)

function Step3() {
  const { t } = useTranslation('wizard');
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { analysisResult, repoUrl, branch, gitToken, setAnalysisResult, setRepoUrl, setBranch, setStep } = useWizardStore();

  const [phase, setPhase] = useState<NormalizePhase>('idle');
  const [draftId, setDraftId] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<NormalizeFile[]>([]);

  const normalizePreview = useNormalizePreview();
  const normalizeCommit = useNormalizeCommit();
  const reAnalyze = useAnalyzeRepo(currentOrgId);
  const { data: ghStatus } = useGitHubStatus();
  const forkRepo = useGitHubFork();

  // Parse owner/repo from URL to detect non-owned repos
  const [parsedOwner, parsedRepo] = (() => {
    try {
      const parts = new URL(repoUrl).pathname.split('/').filter(Boolean);
      return [parts[0] ?? null, parts[1] ?? null] as const;
    } catch { return [null, null] as const; }
  })();

  const needsFork =
    !!parsedOwner &&
    !!ghStatus?.connected &&
    !!ghStatus.github_login &&
    parsedOwner.toLowerCase() !== ghStatus.github_login.toLowerCase();

  const handleFork = () => {
    if (!parsedOwner || !parsedRepo) return;
    setPhase('forking');
    forkRepo.mutate(
      { owner: parsedOwner, repo: parsedRepo },
      {
        onSuccess: (result) => {
          toast.success(t('normalize.fork.success', { fork: result.full_name }));
          setRepoUrl(result.fork_url);
          setBranch(result.default_branch);
          setPhase('re_analyzing');
          reAnalyze.mutate(
            { repoUrl: result.fork_url, branch: result.default_branch, ...(gitToken ? { gitToken } : {}) },
            {
              onSuccess: (analysis) => { setAnalysisResult(analysis); setPhase('idle'); },
              onError: (err: Error) => { toast.error(err.message); setPhase('idle'); },
            },
          );
        },
        onError: (err: Error) => { toast.error(err.message); setPhase('idle'); },
      },
    );
  };

  if (!analysisResult) { setStep(2); return null; }

  const alreadyNormalized = analysisResult.hasGamadJson;
  const canProceed = alreadyNormalized || phase === 'verified';

  const handlePreview = () => {
    setPhase('previewing');
    normalizePreview.mutate(
      {
        repoUrl,
        branch,
        analysis: {
          has_dockerfile: analysisResult.hasDockerfile,
          has_compose_file: analysisResult.hasCompose,
          has_gamad_json: analysisResult.hasGamadJson,
          detected_framework: analysisResult.detectedFramework,
        },
      },
      {
        onSuccess: (result) => {
          setDraftId(result.draft_id);
          setGeneratedFiles(result.draft.generated_files ?? []);
          setPhase('preview');
        },
        onError: (error: Error) => {
          toast.error(error.message);
          setPhase('idle');
        },
      },
    );
  };

  const handleCommit = () => {
    if (!gitToken && !ghStatus?.connected) {
      toast.error(t('normalize.token.required'));
      return;
    }
    setPhase('committing');
    normalizeCommit.mutate(
      { draftId, repoUrl, branch, gitToken },
      {
        onSuccess: (result) => {
          setPrUrl(result.pr_url);
          setPhase('pr_created');
        },
        onError: (error: Error) => {
          toast.error(error.message);
          setPhase('preview');
        },
      },
    );
  };

  const handleMerged = () => {
    setPhase('re_analyzing');
    reAnalyze.mutate(
      { repoUrl, branch, ...(gitToken ? { gitToken } : {}) },
      {
        onSuccess: (result) => {
          setAnalysisResult(result);
          setPhase('verified');
        },
        onError: (error: Error) => {
          toast.error(error.message);
          setPhase('pr_created');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-[--text]">{t('preflight.title')}</h2>

      {/* Résumé de l'analyse */}
      <dl className="rounded-lg border border-[--border] bg-[--surface] divide-y divide-[--border]">
        {[
          { key: 'preflight.stack', value: analysisResult.stack },
          { key: 'preflight.ports', value: analysisResult.ports.join(', ') || '—' },
          { key: 'preflight.health', value: analysisResult.healthCheckPath || '—' },
        ].map(({ key, value }) => (
          <div key={key} className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-[--text-muted]">{t(key)}</dt>
            <dd className="text-sm font-mono text-[--text]">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between px-5 py-3">
          <dt className="text-sm text-[--text-muted]">{t('preflight.confidence')}</dt>
          <dd>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', CONFIDENCE_CLASS[analysisResult.confidence])}>
              {t(`preflight.confidence.${analysisResult.confidence}`)}
            </span>
          </dd>
        </div>
      </dl>

      {analysisResult.assumptions.length > 0 && (
        <div>
          <p className="text-sm font-medium text-[--text] mb-2">{t('preflight.assumptions')}</p>
          <ul className="space-y-1">
            {analysisResult.assumptions.map((a, i) => (
              <li key={i} className="text-xs text-[--text-muted] flex gap-2">
                <span className="text-[--accent] shrink-0">·</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fork gate — repo non possédé par l'utilisateur GitHub */}
      {!alreadyNormalized && needsFork && phase !== 'verified' && (
        <div className="rounded-lg border border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            {t('normalize.fork.title')}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">{t('normalize.fork.subtitle')}</p>
          <p className="text-xs text-[--text-muted]">
            {t('normalize.fork.hint', { repo: `${parsedOwner}/${parsedRepo}` })}
          </p>
          {(phase === 'forking' || phase === 're_analyzing') ? (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-xs">
                {phase === 'forking' ? t('normalize.fork.loading') : t('normalize.reanalyze')}
              </span>
            </div>
          ) : (
            <Button size="sm" onClick={handleFork} className="w-full">
              {t('normalize.fork.btn')}
            </Button>
          )}
        </div>
      )}

      {/* Gate de normalisation — obligatoire si pas de gamad.json (et repo possédé) */}
      {!alreadyNormalized && !needsFork && phase !== 'verified' && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            ⚠ {t('normalize.required')}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('normalize.subtitle')}</p>

          {phase === 'idle' && (
            <Button size="sm" onClick={handlePreview} className="w-full">
              {t('normalize.preview.btn')}
            </Button>
          )}

          {phase === 'previewing' && (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[--accent]" />
              <span className="text-xs">{t('normalize.previewing')}</span>
            </div>
          )}

          {phase === 'preview' && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-[--text]">{t('normalize.files.title')}</p>
              <ul className="space-y-0.5">
                <li className="text-xs font-mono text-[--text-muted]">· gamad.json</li>
                {generatedFiles.map((f) => (
                  <li key={f.path} className="text-xs font-mono text-[--text-muted]">· {f.path}</li>
                ))}
              </ul>
              {!gitToken && !ghStatus?.connected && (
                <p className="text-xs text-red-500">{t('normalize.token.required')}</p>
              )}
              <Button size="sm" onClick={handleCommit} disabled={!gitToken && !ghStatus?.connected} className="w-full">
                {t('normalize.commit.btn')}
              </Button>
            </div>
          )}

          {phase === 'committing' && (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[--accent]" />
              <span className="text-xs">{t('normalize.committing')}</span>
            </div>
          )}

          {phase === 'pr_created' && (
            <div className="space-y-3">
              <div className="text-xs">
                <span className="font-medium">{t('normalize.pr.done')} </span>
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[--accent] underline break-all"
                >
                  {prUrl}
                </a>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('normalize.pr.merge_hint')}</p>
              <Button size="sm" onClick={handleMerged} className="w-full">
                {t('normalize.pr.merged')}
              </Button>
            </div>
          )}

          {phase === 're_analyzing' && (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[--accent]" />
              <span className="text-xs">{t('normalize.reanalyze')}</span>
            </div>
          )}
        </div>
      )}

      {/* Bannière "normalisé" */}
      {phase === 'verified' && (
        <div className="rounded-lg border border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-center gap-2">
          <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {t('normalize.verified')}
          </span>
        </div>
      )}

      <StepFooter
        onNext={() => setStep(4)}
        onBack={() => setStep(2)}
        nextDisabled={!canProceed}
      />
    </div>
  );
}

// ── Step 4 : Server ───────────────────────────────────────────────────────────

const newServerSchema = z.object({
  name: z.string().min(1, 'error.required'),
  host: z.string().min(1, 'error.required'),
  port: z.string().regex(/^\d+$/, 'error.required'),
});
type NewServerFormValues = z.infer<typeof newServerSchema>;

function Step4() {
  const { t } = useTranslation(['wizard', 'common', 'servers']);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { serverId, setServerId, setStep } = useWizardStore();
  const { data: serverList, isLoading: serversLoading } = useServers(currentOrgId);
  const createServer = useCreateServer(currentOrgId);
  const [showNewServer, setShowNewServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdServer, setCreatedServer] = useState<ServerCreatedResult | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<NewServerFormValues>({
    resolver: zodResolver(newServerSchema),
  });

  const advance = () => {
    if (!serverId) { setServerError(t('server.required', { ns: 'wizard' })); return; }
    setStep(5);
  };

  const onNewServerSubmit = (data: NewServerFormValues) => {
    createServer.mutate(
      { name: data.name, host: data.host, port: parseInt(data.port, 10) },
      {
        onSuccess: (result) => {
          setServerId(result.id);
          setCreatedServer(result);
        },
        onError: () => {
          toast.error(t('server.create.error', { ns: 'wizard' }));
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-[--text]">{t('server.title', { ns: 'wizard' })}</h2>

      {/* Existing servers */}
      {!showNewServer && (
        <div className="space-y-3">
          <Label>{t('server.select.label', { ns: 'wizard' })}</Label>
          {serversLoading ? (
            <p className="text-sm text-[--text-muted]">{t('server.loading', { ns: 'wizard' })}</p>
          ) : (serverList?.length ?? 0) === 0 ? (
            <p className="text-sm text-[--text-muted]">{t('server.none', { ns: 'wizard' })}</p>
          ) : (
            <div className="space-y-2">
              {serverList?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setServerId(s.id); setServerError(null); }}
                  className={cn(
                    'w-full rounded-lg border-2 px-4 py-3 text-left transition-all',
                    serverId === s.id
                      ? 'border-[--accent] bg-[rgba(16,185,129,0.06)]'
                      : 'border-[--border] hover:border-[rgba(16,185,129,0.5)]',
                  )}
                >
                  <p className="font-medium text-sm text-[--text]">{s.name}</p>
                  <p className="text-xs text-[--text-muted] font-mono">{s.host}</p>
                </button>
              ))}
            </div>
          )}
          {serverError && <p className="text-xs text-red-500">{serverError}</p>}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowNewServer(true)}
            className="w-full"
          >
            {t('server.new', { ns: 'wizard' })}
          </Button>
        </div>
      )}

      {/* New server form */}
      {showNewServer && (
        <form onSubmit={(e) => { void handleSubmit(onNewServerSubmit)(e); }} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="srvName">{t('server.name', { ns: 'wizard' })}</Label>
            <Input id="srvName" placeholder={t('server.name.placeholder', { ns: 'wizard' })} {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="srvHost">{t('server.host', { ns: 'wizard' })}</Label>
              <Input id="srvHost" placeholder={t('server.host.placeholder', { ns: 'wizard' })} {...register('host')} />
              {errors.host && <p className="text-xs text-red-500">{t(errors.host.message ?? 'error.required', { ns: 'common' })}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="srvPort">{t('server.port', { ns: 'wizard' })}</Label>
              <Input id="srvPort" placeholder={t('server.port.placeholder', { ns: 'wizard' })} {...register('port')} />
              {errors.port && <p className="text-xs text-red-500">{t(errors.port.message ?? 'error.required', { ns: 'common' })}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setShowNewServer(false)} className="flex-1">
              {t('back')}
            </Button>
            <Button type="submit" disabled={createServer.isPending} className="flex-1 gap-2">
              {createServer.isPending && <Loader2 size={14} className="animate-spin" />}
              {t('server.create', { ns: 'wizard' })}
            </Button>
          </div>
        </form>
      )}

      {!showNewServer && <StepFooter onNext={advance} onBack={() => setStep(3)} />}

      {/* Install modal — shown after new server created, onClose advances to Step 5 */}
      {createdServer && (
        <SecretRevealModal
          open={!!createdServer}
          onClose={() => { setCreatedServer(null); setStep(5); }}
          title={t('modal.install.title', { ns: 'servers' })}
          description={t('modal.install.desc', { ns: 'servers' })}
          secret={buildDockerRunCommand(createdServer.port, createdServer.token)}
          confirmLabel={t('modal.install.confirm', { ns: 'servers' })}
          closeLabel={t('modal.install.close', { ns: 'servers' })}
          copyLabel={t('modal.install.copy', { ns: 'servers' })}
          copiedLabel={t('modal.install.copied', { ns: 'servers' })}
        />
      )}
    </div>
  );
}

// ── Step 5 : Domain ───────────────────────────────────────────────────────────

function Step5() {
  const { t } = useTranslation('wizard');
  const { domain, httpsEnabled, setDomain, setHttpsEnabled, setStep } = useWizardStore();

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-[--text]">{t('domain.title')}</h2>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="domain">
            {t('domain.field')}
            <span className="ml-2 text-xs text-[--text-muted]">{t('domain.field.optional')}</span>
          </Label>
          <Input
            id="domain"
            placeholder={t('domain.field.placeholder')}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            autoComplete="off"
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            role="checkbox"
            aria-checked={httpsEnabled}
            tabIndex={0}
            onClick={() => setHttpsEnabled(!httpsEnabled)}
            onKeyDown={(e) => e.key === ' ' && setHttpsEnabled(!httpsEnabled)}
            className={cn(
              'relative flex h-5 w-9 items-center rounded-full transition-colors',
              httpsEnabled ? 'bg-[--accent]' : 'bg-[--border]',
            )}
          >
            <span
              className={cn(
                'absolute h-4 w-4 rounded-full bg-white shadow transition-transform',
                httpsEnabled ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </div>
          <span className="text-sm text-[--text]">{t('domain.https')}</span>
        </label>
        <p className="text-xs text-[--text-muted] border border-[--border] rounded-md px-3 py-2">
          {t('domain.proxy.label')}
        </p>
      </div>
      <StepFooter onNext={() => setStep(6)} onBack={() => setStep(4)} />
    </div>
  );
}

// ── Step 6 : Summary ──────────────────────────────────────────────────────────

function Step6() {
  const { t } = useTranslation('wizard');
  const navigate = useNavigate();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const wizard = useWizardStore();
  const createDeployment = useCreateDeployment();

  const deploy = () => {
    if (!currentOrgId || !wizard.serverId) return;
    createDeployment.mutate(
      {
        orgId: currentOrgId,
        repoUrl: wizard.repoUrl,
        branch: wizard.branch,
        ...(wizard.gitToken ? { gitToken: wizard.gitToken } : {}),
        serverId: wizard.serverId,
        ...(wizard.domain ? { domain: wizard.domain } : {}),
        httpsEnabled: wizard.httpsEnabled,
        hasCompose: wizard.analysisResult?.hasCompose ?? false,
        hasDockerfile: wizard.analysisResult?.hasDockerfile ?? false,
        hasGamadJson: wizard.analysisResult?.hasGamadJson ?? false,
        detectedFramework: wizard.analysisResult?.detectedFramework ?? '',
      },
      {
        onSuccess: (deployment) => {
          wizard.reset();
          void navigate(`/app/deployments/${deployment.id}`);
        },
        onError: () => {
          toast.error(t('summary.deploying'));
        },
      },
    );
  };

  const rows: Array<{ key: string; value: string }> = [
    { key: 'summary.repo', value: wizard.repoUrl || '—' },
    { key: 'summary.branch', value: wizard.branch || '—' },
    { key: 'summary.stack', value: wizard.analysisResult?.stack ?? t('summary.stack.unknown') },
    { key: 'summary.domain', value: wizard.domain || t('summary.domain.none') },
    { key: 'summary.https', value: wizard.httpsEnabled ? t('summary.https.on') : t('summary.https.off') },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-[--text]">{t('summary.title')}</h2>
      <dl className="rounded-lg border border-[--border] bg-[--surface] divide-y divide-[--border]">
        {rows.map(({ key, value }) => (
          <div key={key} className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-[--text-muted]">{t(key)}</dt>
            <dd className="text-sm font-mono text-[--text] max-w-xs truncate text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <StepFooter
        onNext={deploy}
        nextLabel={t('summary.deploy')}
        isLoading={createDeployment.isPending}
        loadingLabel={t('summary.deploying')}
        onBack={() => wizard.setStep(5)}
      />
    </div>
  );
}

// ── Shared footer ─────────────────────────────────────────────────────────────

interface StepFooterProps {
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;
  nextLabel?: string;
  submitLabel?: string;
  loadingLabel?: string;
  isSubmit?: boolean;
  isLoading?: boolean;
  nextDisabled?: boolean;
}

function StepFooter({
  onNext,
  onBack,
  showBack = true,
  nextLabel,
  submitLabel,
  loadingLabel,
  isSubmit = false,
  isLoading = false,
  nextDisabled = false,
}: StepFooterProps) {
  const { t } = useTranslation('wizard');
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between pt-2">
      <Button
        type="button"
        variant="ghost"
        onClick={() => void navigate('/app/projects')}
        className="text-[--text-muted]"
      >
        {t('cancel')}
      </Button>
      <div className="flex gap-3">
        {showBack && onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            {t('back')}
          </Button>
        )}
        <Button
          type={isSubmit ? 'submit' : 'button'}
          onClick={isSubmit ? undefined : onNext}
          disabled={isLoading || nextDisabled}
          className="gap-2"
        >
          {isLoading && <Loader2 size={14} className="animate-spin" />}
          {isLoading ? (loadingLabel ?? t('next')) : (submitLabel ?? nextLabel ?? t('next'))}
        </Button>
      </div>
    </div>
  );
}

// ── Wizard root ───────────────────────────────────────────────────────────────

const STEP_COMPONENTS: Record<number, React.ComponentType> = {
  1: Step1,
  2: Step2,
  3: Step3,
  4: Step4,
  5: Step5,
  6: Step6,
};

const TOTAL_STEPS = 6;

export function DeploymentWizard() {
  const { t } = useTranslation('wizard');
  const { step } = useWizardStore();
  const location = useLocation();
  const StepComponent = STEP_COMPONENTS[step] ?? Step1;

  // Pre-fill from ProjectsPage "Deploy" button: skip wizard, jump to summary.
  useEffect(() => {
    const state = location.state as { repoUrl?: string; branch?: string; serverId?: string } | null;
    if (state?.repoUrl) {
      const s = useWizardStore.getState();
      s.reset();
      s.setProjectType('git');
      s.setRepoUrl(state.repoUrl);
      s.setBranch(state.branch ?? 'main');
      s.setServerId(state.serverId ?? null);
      s.setStep(6);
    }
  }, []); // intentionally empty — process router state once on mount

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-bold text-[--text] mb-6">{t('title')}</h1>
      <Stepper current={step} total={TOTAL_STEPS} />
      <div className="rounded-lg border border-[--border] bg-[--surface] p-6">
        <StepComponent />
      </div>
    </div>
  );
}
