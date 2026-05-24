import { useTranslation } from 'react-i18next';
import { Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const TESTIMONIALS = ['1', '2', '3'] as const;

export function Testimonials() {
  const { t } = useTranslation('landing');

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8 bg-[--surface]">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl font-bold text-[--text] sm:text-4xl">{t('testimonials.title')}</h2>
          <p className="mt-4 text-[--text-muted]">{t('testimonials.subtitle')}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((n) => (
            <Card key={n} className="hover:border-[--accent] transition-colors">
              <CardContent className="pt-6">
                <Quote size={24} className="text-[--accent] opacity-40 mb-3" />
                <p className="text-sm text-[--text] leading-relaxed italic">{t(`testimonials.${n}.quote`)}</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(16,185,129,0.15)] font-display font-bold text-[--accent] text-sm">
                    {t(`testimonials.${n}.name`).charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[--text]">{t(`testimonials.${n}.name`)}</p>
                    <p className="text-xs text-[--text-muted]">{t(`testimonials.${n}.role`)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
