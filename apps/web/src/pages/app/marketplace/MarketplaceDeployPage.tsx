import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useMarketplaceTemplate, useDeployTemplate } from '@/api/marketplace';
import { useServers } from '@/api/servers';
import { useAuthStore } from '@/store/auth.store';

type Step = 'server' | 'domain';

export function MarketplaceDeployPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);

  const { data: template, isLoading: templateLoading } = useMarketplaceTemplate(slug);
  const { data: servers, isLoading: serversLoading } = useServers(currentOrgId);
  const deployTemplate = useDeployTemplate();

  const [step, setStep] = useState<Step>('server');
  const [serverId, setServerId] = useState('');
  const [domain, setDomain] = useState('');
  const [httpsEnabled, setHttpsEnabled] = useState(true);

  const isLoading = templateLoading || serversLoading;

  const handleDeploy = () => {
    if (!template?.id) return;
    deployTemplate.mutate(
      { id: template.id, serverId, ...(domain ? { domain } : {}), httpsEnabled },
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
        <p className="text-sm text-[--text-muted]">Configurez le déploiement en 2 étapes.</p>
      </div>

      {/* Indicateur d'étapes */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'rounded-full px-2.5 py-1 font-medium',
            step === 'server'
              ? 'bg-[--accent] text-white'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
          )}
        >
          1. Serveur
        </span>
        <ArrowRight size={12} className="text-[--text-muted]" />
        <span
          className={cn(
            'rounded-full px-2.5 py-1 font-medium',
            step === 'domain'
              ? 'bg-[--accent] text-white'
              : 'bg-[--border] text-[--text-muted]',
          )}
        >
          2. Domaine
        </span>
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
              <Button
                onClick={() => setStep('domain')}
                disabled={!serverId}
                className="gap-2"
              >
                Suivant <ArrowRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Étape 2 — Domaine */}
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
            <Switch
              id="https"
              checked={httpsEnabled}
              onCheckedChange={setHttpsEnabled}
            />
            <Label htmlFor="https" className="cursor-pointer">
              Activer HTTPS (Let's Encrypt)
            </Label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setStep('server')}
              className="gap-2"
            >
              <ArrowLeft size={14} /> Retour
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={deployTemplate.isPending}
              className="gap-2"
            >
              {deployTemplate.isPending && <Loader2 size={14} className="animate-spin" />}
              Déployer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
