import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Hero() {
  const { t } = useTranslation('landing');

  const title = t('hero.title');
  const [titleFirst, titleSecond] = title.split('\n');

  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      {/* Glow émeraude */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-96 w-96 rounded-full bg-[--accent] opacity-10 blur-3xl" />

      <div className="relative mx-auto max-w-4xl text-center">
        <Badge className="mb-6 animate-fade-in">{t('hero.badge')}</Badge>

        <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-[--text] sm:text-5xl lg:text-6xl animate-fade-up">
          {titleFirst}
          {titleSecond && (
            <>
              <br />
              <span className="text-[--accent]">{titleSecond}</span>
            </>
          )}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[--text-muted] animate-fade-up [animation-delay:100ms] opacity-0 [animation-fill-mode:forwards]">
          {t('hero.subtitle')}
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-fade-up [animation-delay:200ms] opacity-0 [animation-fill-mode:forwards]">
          <Link to="/auth/register">
            <Button size="lg" className="gap-2">
              {t('hero.cta.start')}
              <ArrowRight size={18} />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="gap-2">
            <Play size={16} />
            {t('hero.cta.demo')}
          </Button>
        </div>

        {/* Terminal décoratif */}
        <div className="mx-auto mt-16 max-w-2xl animate-fade-up [animation-delay:300ms] opacity-0 [animation-fill-mode:forwards]">
          <div className="rounded-xl border border-[--border] bg-[--surface] overflow-hidden shadow-xl shadow-[rgba(16,185,129,0.08)]">
            <div className="flex items-center gap-2 border-b border-[--border] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-[--text-muted] font-mono-data">gamad deploy</span>
            </div>
            <div className="p-4 font-mono-data text-xs text-left space-y-1">
              <p><span className="text-[--accent]">$</span> <span className="text-[--text]">git push origin main</span></p>
              <p className="text-[--text-muted]">→ Analyse du dépôt…</p>
              <p className="text-[--text-muted]">→ Stack détectée : Node.js + PostgreSQL</p>
              <p className="text-[--text-muted]">→ Build en cours…</p>
              <p className="text-[--accent]">✓ Déploiement réussi sur votre VPS</p>
              <p className="text-[--accent]">✓ https://monapp.votrevps.com</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
