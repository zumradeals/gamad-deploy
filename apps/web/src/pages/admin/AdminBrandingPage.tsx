// AdminBrandingPage — formulaire de branding de la plateforme.
// Upload logo, couleurs, nom, tagline.

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useAdminSettings, useUpdateAdminSettings, useUploadLogo } from '@/api/admin';

export function AdminBrandingPage() {
  const { data: settings, isLoading } = useAdminSettings();
  const updateMutation = useUpdateAdminSettings();
  const uploadMutation = useUploadLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state — initialisé depuis les settings
  const getVal = (key: string) =>
    settings?.find((s) => s.key === key)?.value ?? '';

  const [platformName, setPlatformName] = useState('');
  const [tagline, setTagline] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');

  // Initialise les champs une seule fois quand les settings arrivent
  const [initialized, setInitialized] = useState(false);
  if (!initialized && settings && settings.length > 0) {
    setPlatformName(getVal('platform_name'));
    setTagline(getVal('tagline'));
    setPrimaryColor(getVal('primary_color') || '#10B981');
    setSecondaryColor(getVal('secondary_color') || '#6366F1');
    setInitialized(true);
  }

  const logoUrl = getVal('logo_url');

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        platform_name: platformName,
        tagline,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      // Injecte immédiatement les CSS variables pour le branding dynamique
      document.documentElement.style.setProperty('--accent', primaryColor);
      toast.success('Branding enregistré.');
    } catch {
      toast.error('Erreur lors de l\'enregistrement.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadMutation.mutateAsync(file);
      toast.success('Logo uploadé avec succès.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur upload';
      toast.error(msg);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <Card className="bg-gray-900 border-gray-800 p-5 space-y-5">
        {/* Nom de la plateforme */}
        <div className="space-y-1.5">
          <Label className="text-gray-300">Nom de la plateforme</Label>
          <Input
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white"
            placeholder="GAMAD Deploy"
          />
        </div>

        {/* Tagline */}
        <div className="space-y-1.5">
          <Label className="text-gray-300">Tagline</Label>
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white"
            placeholder="Déployez sans DevOps"
          />
        </div>

        {/* Couleurs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-gray-300">Couleur principale</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-9 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white font-mono text-sm"
                placeholder="#10B981"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-300">Couleur secondaire</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-9 w-9 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white font-mono text-sm"
                placeholder="#6366F1"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </Card>

      {/* Logo */}
      <Card className="bg-gray-900 border-gray-800 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-200">Logo</p>
          <p className="text-xs text-gray-500 mt-0.5">
            JPG, PNG, WebP ou SVG — max 2 Mo
          </p>
        </div>

        {logoUrl && (
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Logo actuel"
              className="h-12 w-12 rounded-lg object-contain bg-gray-800 p-1"
            />
            <span className="text-xs text-gray-400 truncate">{logoUrl}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.svg"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700"
          >
            {uploadMutation.isPending ? 'Upload…' : 'Choisir un fichier'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
