import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function Pricing() {
  const { t } = useTranslation('landing');
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      key: 'starter',
      features: ['f1','f2','f3','f4','f5'],
      highlighted: false,
      price: annual ? t('pricing.starter.price.annual') : t('pricing.starter.price.monthly'),
      isFree: true,
    },
    {
      key: 'pro',
      features: ['f1','f2','f3','f4','f5','f6'],
      highlighted: true,
      price: annual ? t('pricing.pro.price.annual') : t('pricing.pro.price.monthly'),
      isFree: false,
    },
    {
      key: 'enterprise',
      features: ['f1','f2','f3','f4','f5','f6'],
      highlighted: false,
      price: null,
      isFree: false,
    },
  ] as const;

  return (
    <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl font-bold text-[--text] sm:text-4xl">{t('pricing.title')}</h2>
          <p className="mt-4 text-[--text-muted]">{t('pricing.subtitle')}</p>

          {/* Toggle mensuel/annuel */}
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[--border] bg-[--surface] p-1">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm transition-all',
                !annual ? 'bg-[--accent] text-white font-medium' : 'text-[--text-muted]',
              )}
            >
              {t('pricing.toggle.monthly')}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-all',
                annual ? 'bg-[--accent] text-white font-medium' : 'text-[--text-muted]',
              )}
            >
              {t('pricing.toggle.annual')}
              <Badge variant="success" className="text-[10px] px-1.5 py-0">{t('pricing.save')}</Badge>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map(({ key, features, highlighted, price, isFree }) => (
            <Card
              key={key}
              className={cn(
                'relative flex flex-col',
                highlighted && 'border-[--accent] shadow-lg shadow-[rgba(16,185,129,0.15)] scale-[1.02]',
              )}
            >
              {highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>{t(`pricing.${key}.badge` as `pricing.pro.badge`)}</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{t(`pricing.${key}.name`)}</CardTitle>
                <CardDescription>{t(`pricing.${key}.desc`)}</CardDescription>
                <div className="mt-4">
                  {key === 'enterprise' ? (
                    <span className="font-display text-2xl font-bold text-[--text]">{t('pricing.enterprise.price')}</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-3xl font-bold text-[--text]">{price}</span>
                      {!isFree && <span className="text-sm text-[--text-muted]">{t('pricing.pro.currency')}</span>}
                      {isFree && <span className="text-sm text-[--text-muted]">XOF</span>}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[--text]">
                      <Check size={15} className="shrink-0 text-[--accent]" />
                      {t(`pricing.${key}.${f}`)}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link to={key === 'enterprise' ? '/contact' : '/auth/register'} className="w-full">
                  <Button
                    variant={highlighted ? 'default' : 'outline'}
                    className="w-full"
                  >
                    {t(`pricing.${key}.cta`)}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
