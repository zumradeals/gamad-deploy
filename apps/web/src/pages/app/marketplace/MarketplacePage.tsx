import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useMarketplace } from '@/api/marketplace';
import type { MarketplaceTemplate } from '@/api/marketplace';

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

function truncate(str: string, max: number): string {
  return str.length <= max ? str : `${str.slice(0, max)}…`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TemplateCardSkeleton() {
  return (
    <div className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-3 animate-pulse">
      <div className="h-5 bg-[--border] rounded w-3/4" />
      <div className="h-3 bg-[--border] rounded w-full" />
      <div className="h-3 bg-[--border] rounded w-2/3" />
      <div className="flex gap-2 mt-4">
        <div className="h-5 w-16 bg-[--border] rounded-full" />
        <div className="h-5 w-16 bg-[--border] rounded-full" />
      </div>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: MarketplaceTemplate }) {
  const visibleTags = template.tags.slice(0, 3);

  return (
    <div className="rounded-lg border border-[--border] bg-[--surface] p-5 flex flex-col gap-3 hover:border-[--accent]/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-[--text] text-sm leading-tight">{template.name}</h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            LEVEL_CLASSES[template.marketplaceLevel] ?? LEVEL_CLASSES.draft,
          )}
        >
          {LEVEL_LABELS[template.marketplaceLevel] ?? template.marketplaceLevel}
        </span>
      </div>

      <p className="text-xs text-[--text-muted] leading-relaxed flex-1">
        {truncate(template.description || 'Aucune description.', 80)}
      </p>

      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[--border] px-2 py-0.5 text-[10px] text-[--text-muted] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-[--border]">
        <div>
          <p className="font-bold text-sm text-[--accent]">{formatPrice(template.priceAmount)}</p>
          <p className="text-[10px] text-[--text-muted] mt-0.5">{template.usageCount} utilisation{template.usageCount !== 1 ? 's' : ''}</p>
        </div>
        <Link to={`/app/marketplace/${template.slug}`}>
          <Button variant="outline" size="sm" className="text-xs h-7">
            Voir
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);

  const { data: templates, isLoading } = useMarketplace({ search, freeOnly });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store size={20} className="text-[--accent]" />
          <h1 className="font-display text-xl font-bold text-[--text]">Marketplace</h1>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Rechercher un template…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="freeOnly"
            checked={freeOnly}
            onCheckedChange={setFreeOnly}
          />
          <Label htmlFor="freeOnly" className="text-sm text-[--text-muted] cursor-pointer">
            Gratuits uniquement
          </Label>
        </div>
      </div>

      {/* Grille */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : (templates?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-[--border] bg-[--surface] p-12 text-center">
          <Store size={32} className="mx-auto mb-3 text-[--text-muted] opacity-40" />
          <p className="font-medium text-[--text]">Aucun template disponible</p>
          <p className="text-sm text-[--text-muted] mt-1">
            {search || freeOnly ? 'Modifiez vos filtres pour voir plus de résultats.' : 'Le marketplace est vide pour l\'instant.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((t) => <TemplateCard key={t.id} template={t} />)}
        </div>
      )}
    </div>
  );
}
