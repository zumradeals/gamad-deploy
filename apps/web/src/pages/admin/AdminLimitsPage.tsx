// AdminLimitsPage — champs numériques pour les limites par défaut.

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminSettings, useUpdateAdminSettings } from '@/api/admin';

export function AdminLimitsPage() {
  const { data: settings, isLoading } = useAdminSettings();
  const updateMutation = useUpdateAdminSettings();

  const [maxProjects, setMaxProjects] = useState('5');
  const [maxServers, setMaxServers] = useState('3');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && settings && settings.length > 0) {
      const p = settings.find((s) => s.key === 'default_max_projects');
      const sv = settings.find((s) => s.key === 'default_max_servers');
      if (p) setMaxProjects(p.value);
      if (sv) setMaxServers(sv.value);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = async () => {
    const pNum = parseInt(maxProjects, 10);
    const sNum = parseInt(maxServers, 10);
    if (isNaN(pNum) || pNum < 1) {
      toast.error('Nombre de projets invalide (minimum 1).');
      return;
    }
    if (isNaN(sNum) || sNum < 1) {
      toast.error('Nombre de serveurs invalide (minimum 1).');
      return;
    }
    try {
      await updateMutation.mutateAsync({
        default_max_projects: String(pNum),
        default_max_servers: String(sNum),
      });
      toast.success('Limites mises à jour.');
    } catch {
      toast.error('Erreur lors de la mise à jour.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-16 rounded-lg bg-gray-800" />
        <div className="h-16 rounded-lg bg-gray-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Card className="bg-gray-900 border-gray-800 p-5 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-gray-300">Projets max par organisation (défaut)</Label>
          <Input
            type="number"
            min={1}
            value={maxProjects}
            onChange={(e) => setMaxProjects(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white w-32"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-gray-300">Serveurs max par organisation (défaut)</Label>
          <Input
            type="number"
            min={1}
            value={maxServers}
            onChange={(e) => setMaxServers(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white w-32"
          />
        </div>

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
