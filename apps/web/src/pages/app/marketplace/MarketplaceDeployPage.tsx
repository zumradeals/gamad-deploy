import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, Server, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useMarketplaceTemplate, useDeployTemplate } from '@/api/marketplace';
import { useServers } from '@/api/servers';
import { useAuthStore } from '@/store/auth.store';

type Step = 'server' | 'env' | 'domain';

interface EnvVar { name: string; required: boolean; secret: boolean; default?: string; }

function parseEnvVars(contractContent: string | null | undefined): EnvVar[] {
  if (!contractContent) return [];
  try {
    const c = JSON.parse(contractContent) as { env?: EnvVar[] };
    return Array.isArray(c.env) ? c.env : [];
  } catch { return []; }
}

export function MarketplaceDeployPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);

  const { data: template, isLoading: templateLoading } = useMarketplaceTemplate(slug);
  const { data: servers, isLoading: serversLoading } = useServers(currentOrgId);
  const deployTemplate = useDeployTemplate();

  const envVarDefs = parseEnvVars(template?.contractContent);
  const hasEnvVars = envVarDefs.length > 0;

  const [step, setStep] = useState<Step>('server');
  const [serverId, setServerId] = useState('');
  const [domain, setDomain] = useState('');
  const [httpsEnabled, setHttpsEnabled] = useState(true);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Pré-remplir les valeurs par défaut des env vars quand le template change.
  const templateId = template?.id;
  useEffect(() => {
    if (!templateId) return;
    const defs = parseEnvVars(template?.contractContent);
    const defaults: Record<string, string> = {};
    defs.forEach((v) => { if (v.default) defaults[v.name] = v.default; });
    setEnvValues(defaults);
  }, [templateId, template?.contractContent]);

  const isLoading = templateLoading || serversLoading;

  const stepsOrder: Step[] = hasEnvVars ? ['server', 'env', 'domain'] : ['server', 'domain'];
  const stepIdx = stepsOrder.indexOf(step);
  const stepLabels: Record<Step, string> = { server: 'Serveur', env: 'Variables', domain: 'Domaine' };

  const handleNext = () => {
    const next = stepsOrder[stepIdx + 1];
    if (next) setStep(next);
  };
  const handleBack = () => {
    const prev = stepsOrder[stepIdx - 1];
    if (prev) setStep(prev);
  };

  const handleDeploy = () => {
    if (!template?.id) return;

    // Vérification des variables requises.
    const missing = envVarDefs.filter((v) => v.required && !envValues[v.name]?.trim());
    if (missing.length > 0) {
      toast.error(`Variables requises manquantes : ${missing.map((v) => v.name).join(', ')}`);
      return;
    }

    const deployParams = {
      id: template.id,
      serverId,
      httpsEnabled,
      ...(domain ? { domain } : {}),
      ...(Object.keys(envValues).some((k) => envValues[k]) ? { envVars: envValues } : {}),
    };
    deployTemplate.mutate(
      deployParams,
      {
        onSuccess: ({ deploymentId }) => {
          void navigate(`/app/deployments/${deploymentId}`);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erreur lors du déploiement.');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={24} className="animate-spin text-[--text-muted]" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="max-w-xl space-y-4">
        <Link to="/app/marketplace" className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--text]">
          <ArrowLeft size={14} /> Retour
        </Link>
        <p className="text-[--text-muted]">Template introuvable.</p>
      </div>
    );
  }

  const noServers = !servers || servers.length === 0;

  return (
    <div className="max-w-xl space-y-6">
      <Link
        to={`/app/marketplace/${slug}`}
        className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--text] transition-colors"
      >
        <ArrowLeft size={14} /> Retour à {template.name}
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-xl font-bold text-[--text]">Déployer {template.name}</h1>
        <p className="text-sm text-[--text-muted]">Configurez le déploiement en {stepsOrder.length} étapes.</p>
      </div>

      {/* Indicateur d'étapes */}
      <div className="flex items-center gap-2 text-xs">
        {stepsOrder.map((s, i) => (
          <>
            <span
              key={s}
              className={cn(
                'rounded-full px-2.5 py-1 font-medium',
                step === s
                  ? 'bg-[--accent] text-white'
                  : stepsOrder.indexOf(step) > i
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-[--border] text-[--text-muted]',
              )}
            >
              {i + 1}. {stepLabels[s]}
            </span>
            {i < stepsOrder.length - 1 && <ArrowRight key={`arrow-${s}`} size={12} className="text-[--text-muted]" />}
          </>
        ))}
      </div>

      {/* Étape 1 — Serveur */}
      {step === 'server' && (
        <div className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-4">
          <h2 className="font-semibold text-sm text-[--text]">Choisissez un serveur cible</h2>

          {noServers ? (
            <div className="text-center py-6 space-y-3">
              <Server size={28} className="mx-auto text-[--text-muted] opacity-40" />
              <p className="text-sm text-[--text]">Aucun serveur enregistré</p>
              <p className="text-xs text-[--text-muted]">Ajoutez d'abord un serveur VPS pour pouvoir déployer.</p>
              <Link to="/app/servers">
                <Button variant="outline" size="sm">Gérer les serveurs</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServerId(s.id)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-lg border px-4 py-3 text-sm text-left transition-colors',
                    serverId === s.id
                      ? 'border-[--accent] bg-[--accent]/5'
                      : 'border-[--border] hover:border-[--accent]/40',
                  )}
                >
                  <div>
                    <p className="font-medium text-[--text]">{s.name}</p>
                    <p className="text-xs text-[--text-muted] font-mono">{s.host}:{s.port}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      s.status === 'online'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-[--border] text-[--text-muted]',
                    )}
                  >
                    {s.status === 'online' ? 'En ligne' : s.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!noServers && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleNext} disabled={!serverId} className="gap-2">
                Suivant <ArrowRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Étape 2 — Variables d'environnement */}
      {step === 'env' && (
        <div className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-sm text-[--text]">Variables d'environnement</h2>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Configurez les variables requises par ce template.
              Les valeurs secrètes sont chiffrées et jamais loggées.
            </p>
          </div>

          <div className="space-y-3">
            {envVarDefs.map((v) => (
              <div key={v.name} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor={`env-${v.name}`} className="font-mono text-xs">
                    {v.name}
                  </Label>
                  {v.required && <span className="text-red-500 text-xs">*</span>}
                  {v.secret && <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">secret</span>}
                </div>
                <div className="relative">
                  <Input
                    id={`env-${v.name}`}
                    type={v.secret && !showSecret[v.name] ? 'password' : 'text'}
                    placeholder={v.default ?? (v.required ? 'Requis' : 'Optionnel')}
                    value={envValues[v.name] ?? ''}
                    onChange={(e) => setEnvValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                    className="font-mono text-xs pr-8"
                  />
                  {v.secret && (
                    <button
                      type="button"
                      onClick={() => setShowSecret((prev) => ({ ...prev, [v.name]: !prev[v.name] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-[--text]"
                    >
                      {showSecret[v.name] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft size={14} /> Retour
            </Button>
            <Button onClick={handleNext} className="gap-2">
              Suivant <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Étape finale — Domaine */}
      {step === 'domain' && (
        <div className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-4">
          <h2 className="font-semibold text-sm text-[--text]">Configuration du domaine</h2>

          <div className="space-y-1.5">
            <Label htmlFor="domain">Domaine personnalisé <span className="text-[--text-muted]">(optionnel)</span></Label>
            <Input
              id="domain"
              placeholder="monapp.example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch id="https" checked={httpsEnabled} onCheckedChange={setHttpsEnabled} />
            <Label htmlFor="https" className="cursor-pointer">Activer HTTPS (Let's Encrypt)</Label>
          </div>

          {/* Récap env vars non-vides */}
          {Object.keys(envValues).filter((k) => envValues[k]).length > 0 && (
            <div className="rounded-md border border-[--border] bg-[--bg] px-3 py-2 space-y-1">
              <p className="text-xs font-medium text-[--text-muted]">Variables configurées</p>
              {Object.entries(envValues).filter(([, v]) => v).map(([k, v]) => {
                const def = envVarDefs.find((e) => e.name === k);
                return (
                  <div key={k} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-[--text-muted]">{k}</span>
                    <span className="text-[--text]">{def?.secret ? '••••••' : v}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft size={14} /> Retour
            </Button>
            <Button onClick={handleDeploy} disabled={deployTemplate.isPending} className="gap-2">
              {deployTemplate.isPending && <Loader2 size={14} className="animate-spin" />}
              Déployer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
