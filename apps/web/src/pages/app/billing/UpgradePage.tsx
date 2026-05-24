import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Pricing } from '@/pages/landing/Pricing';
import { useAuthStore } from '@/store/auth.store';
import { useCreateCheckout } from '@/api/billing';

export function UpgradePage() {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const createCheckout = useCreateCheckout(currentOrgId);

  const onSelectPlan = (planKey: string) => {
    if (planKey === 'enterprise') {
      void navigate('/contact');
      return;
    }
    createCheckout.mutate(planKey, {
      onSuccess: ({ checkoutUrl }) => {
        window.location.href = checkoutUrl;
      },
      onError: () => toast.error(t('upgrade.error')),
    });
  };

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => void navigate('/app/billing')}
      >
        <ArrowLeft size={13} />
        {t('upgrade.back')}
      </Button>

      <Pricing onSelectPlan={onSelectPlan} />
    </div>
  );
}
