// AdminMaintenancePage — toggle maintenance_mode + message.

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAdminSettings, useUpdateAdminSettings } from '@/api/admin';

export function AdminMaintenancePage() {
  const { data: settings, isLoading } = useAdminSettings();
  const updateMutation = useUpdateAdminSettings();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [message, setMessage] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && settings && settings.length > 0) {
      const mode = settings.find((s) => s.key === 'maintenance_mode');
      const msg = settings.find((s) => s.key === 'maintenance_message');
      if (mode) setMaintenanceMode(mode.value === 'true');
      if (msg) setMessage(msg.value);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        maintenance_mode: maintenanceMode ? 'true' : 'false',
        maintenance_message: message,
      });
      toast.success('Paramètres de maintenance enregistrés.');
    } catch {
      toast.error('Erreur lors de la mise à jour.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 rounded-lg bg-gray-800" />
        <div className="h-32 rounded-lg bg-gray-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      {maintenanceMode && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium text-amber-400">
            Mode maintenance actif — l'application est inaccessible aux utilisateurs.
          </p>
        </div>
      )}

      <Card className="bg-gray-900 border-gray-800 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-gray-200 text-sm font-medium">Mode maintenance</Label>
            <p className="text-xs text-gray-500 mt-0.5">
              Bloque l'accès à la plateforme pour tous les utilisateurs
            </p>
          </div>
          <Switch
            checked={maintenanceMode}
            onCheckedChange={setMaintenanceMode}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-gray-300">Message de maintenance</Label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="La plateforme est en maintenance. Retour prévu sous 2h."
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
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
