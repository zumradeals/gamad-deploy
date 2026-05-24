import { useTranslation } from 'react-i18next';
import { GitBranch, Wand2, Server, Shield, Users, CreditCard } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const FEATURES = [
  { key: 'git', Icon: GitBranch },
  { key: 'wizard', Icon: Wand2 },
  { key: 'agent', Icon: Server },
  { key: 'sovereign', Icon: Shield },
  { key: 'multitenant', Icon: Users },
  { key: 'payment', Icon: CreditCard },
] as const;

export function Features() {
  const { t } = useTranslation('landing');

  return (
    <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl font-bold text-[--text] sm:text-4xl">{t('features.title')}</h2>
          <p className="mt-4 text-[--text-muted] max-w-2xl mx-auto">{t('features.subtitle')}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, Icon }) => (
            <Card key={key} className="hover:border-[--accent] hover:shadow-md hover:shadow-[rgba(16,185,129,0.1)] transition-all">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(16,185,129,0.1)] text-[--accent]">
                  <Icon size={20} />
                </div>
                <CardTitle>{t(`features.${key}.title`)}</CardTitle>
                <CardDescription className="mt-1 text-sm leading-relaxed">{t(`features.${key}.desc`)}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
