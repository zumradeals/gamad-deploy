// AdminFeaturesPage — toggles on/off pour les feature flags.

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminSettings, useUpdateAdminSettings } from '@/api/admin';

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
}

const FEATURES: FeatureFlag[] = [
  {
    key: 'templates_enabled',
    label: 'Templates',
    description: 'Activer le marketplace de templates',
  },
  {
    key: 'billing_enabled',
    label: 'Facturation',
    description: 'Activer le module de paiement (GeniusPay)',
  },
  {
    key: 'auto_deploy_enabled',
    label: 'Déploiement automatique',
    description: 'Permettre les déploiements auto sur push',
  },
];

export function AdminFeaturesPage() {
  const { data: settings, isLoading } = useAdminSettings();
  const updateMutation = useUpdateAdminSettings();

  const [values, setValues] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && settings && settings.length > 0) {
      const init: Record<string, boolean> = {};
      for (const feature of FEATURES) {
        const s = settings.find((x) => x.key === feature.key);
        init[feature.key] = s?.value === 'true';
      }
      setValues(init);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = async () => {
    try {
      const patch: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        patch[k] = v ? 'true' : 'false';
      }
      await updateMutation.mutateAsync(patch);
      toast.success('Fonctionnalités mises à jour.');
    } catch {
      toast.error('Erreur lors de la mise à jour.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Card className="bg-gray-900 border-gray-800 p-5 space-y-5">
        {FEATURES.map((feature) => (
          <div key={feature.key} className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-gray-200 text-sm font-medium">{feature.label}</Label>
              <p className="text-xs text-gray-500 mt-0.5">{feature.description}</p>
            </div>
            <Switch
              checked={values[feature.key] ?? false}
              onCheckedChange={(checked) =>
                setValues((prev) => ({ ...prev, [feature.key]: checked }))
              }
            />
          </div>
        ))}

        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending || !initialized}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </Card>
    </div>
  );
}
