import { useTranslation } from 'react-i18next';

const STEPS = ['step1', 'step2', 'step3'] as const;

export function HowItWorks() {
  const { t } = useTranslation('landing');

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8 bg-[--surface]">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl font-bold text-[--text] sm:text-4xl">{t('how.title')}</h2>
          <p className="mt-4 text-[--text-muted] max-w-xl mx-auto">{t('how.subtitle')}</p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Ligne de connexion desktop */}
          <div className="pointer-events-none absolute left-1/4 right-1/4 top-8 hidden h-px bg-gradient-to-r from-transparent via-[--accent] to-transparent opacity-30 md:block" />

          {STEPS.map((step, idx) => (
            <div key={step} className="flex flex-col items-center text-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-[--accent] bg-[rgba(16,185,129,0.1)]">
                <span className="font-display text-xl font-bold text-[--accent]">{t(`how.${step}.number`)}</span>
                {idx < 2 && (
                  <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-[--accent] opacity-40 md:block">→</div>
                )}
              </div>
              <h3 className="font-display text-lg font-semibold text-[--text]">{t(`how.${step}.title`)}</h3>
              <p className="text-sm text-[--text-muted] max-w-xs leading-relaxed">{t(`how.${step}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
