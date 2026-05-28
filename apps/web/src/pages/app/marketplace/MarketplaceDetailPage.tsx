import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, ExternalLink, ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMarketplaceTemplate } from '@/api/marketplace';
import { useAuthStore } from '@/store/auth.store';

const LEVEL_CLASSES: Record<string, string> = {
  certified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  valid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  draft: 'bg-[--border] text-[--text-muted]',
};

const LEVEL_LABELS: Record<string, string> = {
  certified: 'Certifié',
  valid: 'Validé',
  draft: 'Brouillon',
};

function formatPrice(amount: number): string {
  if (amount === 0) return 'Gratuit';
  return `${amount.toLocaleString('fr-FR')} XOF`;
}

export function MarketplaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const { data: template, isLoading, isError } = useMarketplaceTemplate(slug);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={24} className="animate-spin text-[--text-muted]" />
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link to="/app/marketplace" className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--text]">
          <ArrowLeft size={14} /> Retour au Marketplace
        </Link>
        <p className="text-[--text-muted]">Template introuvable.</p>
      </div>
    );
  }

  const isAuthenticated = !!token;
  const canDeploy = template.hasAccess;
  const mustPay = !template.hasAccess && template.priceAmount > 0;

  const handleDeploy = () => {
    void navigate(`/app/marketplace/${template.slug}/deploy`);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link to="/app/marketplace" className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--text] transition-colors">
        <ArrowLeft size={14} /> Retour au Marketplace
      </Link>

      <div className="rounded-lg border border-[--border] bg-[--surface] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[--accent]/10">
              <Package size={20} className="text-[--accent]" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[--text]">{template.name}</h1>
              {template.ownerOrgName && (
                <p className="text-xs text-[--text-muted] mt-0.5">par {template.ownerOrgName}</p>
              )}
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
              LEVEL_CLASSES[template.marketplaceLevel] ?? LEVEL_CLASSES.draft,
            )}
          >
            {LEVEL_LABELS[template.marketplaceLevel] ?? template.marketplaceLevel}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-[--text-muted] leading-relaxed">
          {template.description || 'Aucune description fournie.'}
        </p>

        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[--border] px-2.5 py-0.5 text-xs text-[--text-muted] font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 py-3 border-y border-[--border]">
          <div className="text-center">
            <p className="font-bold text-[--text] text-lg">{formatPrice(template.priceAmount)}</p>
            <p className="text-xs text-[--text-muted] mt-0.5">Prix</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-[--text] text-lg">{template.usageCount}</p>
            <p className="text-xs text-[--text-muted] mt-0.5">Utilisations</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-[--text] text-sm">
              {new Date(template.createdAt).toLocaleDateString('fr-FR')}
            </p>
            <p className="text-xs text-[--text-muted] mt-0.5">Publié le</p>
          </div>
        </div>

        {/* Repo link */}
        <a
          href={template.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-[--accent] hover:underline"
        >
          <ExternalLink size={13} />
          Voir le dépôt GitHub
        </a>

        {/* CTA */}
        <div className="pt-1">
          {!isAuthenticated ? (
            <Link to="/auth/login">
              <Button className="w-full">Se connecter pour déployer</Button>
            </Link>
          ) : canDeploy ? (
            <Button className="w-full" onClick={handleDeploy}>
              Déployer
            </Button>
          ) : mustPay ? (
            <Link to={`/app/marketplace/${template.id}/purchase-redirect`}>
              <Button className="w-full">
                Acheter ({formatPrice(template.priceAmount)}) et déployer
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
