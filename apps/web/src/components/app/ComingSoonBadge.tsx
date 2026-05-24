import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function HetznerComingSoonBadge() {
  const { t } = useTranslation('servers');

  return (
    <div className="rounded-xl border-2 border-dashed border-[--accent]/30 bg-gradient-to-br from-[rgba(16,185,129,0.06)] to-transparent p-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[--accent]/10">
          <Sparkles size={13} className="text-[--accent]" />
        </div>
        <span className="text-xs font-bold text-[--accent] uppercase tracking-widest">
          {t('hetzner.badge')}
        </span>
      </div>
      <h3 className="font-display font-semibold text-[--text] mb-1">{t('hetzner.title')}</h3>
      <p className="text-sm text-[--text-muted] leading-relaxed">{t('hetzner.desc')}</p>
    </div>
  );
}
