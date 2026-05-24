import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FinalCTA() {
  const { t } = useTranslation('landing');

  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgba(16,185,129,0.04)] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-[--accent] opacity-10 blur-3xl" />

      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold text-[--text] sm:text-4xl">{t('cta.title')}</h2>
        <p className="mt-4 text-[--text-muted]">{t('cta.subtitle')}</p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link to="/auth/register">
            <Button size="lg" className="gap-2">
              {t('cta.start')} <ArrowRight size={18} />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="gap-2">
            <CalendarDays size={16} />
            {t('cta.demo')}
          </Button>
        </div>
      </div>
    </section>
  );
}
