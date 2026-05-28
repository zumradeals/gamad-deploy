// Hooks React Query pour le dashboard superadmin (Phase 1).
// GET /admin/settings est public (sans JWT) — appel direct via fetch.
// Les autres endpoints nécessitent un JWT superadmin.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminOverview {
  users: { total: number; thisMonth: number };
  orgs: { total: number };
  servers: { total: number; ready: number; error: number };
  deployments: { total: number; running: number; successRate: number };
  revenue: { thisMonth: number; currency: string };
}

export interface PlatformSetting {
  key: string;
  value: string;
  valueType: 'string' | 'boolean' | 'number' | 'json';
  category: 'branding' | 'auth' | 'features' | 'limits' | 'maintenance';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse une valeur de platform_setting vers son type JS. */
export function parseSetting(setting: PlatformSetting): string | boolean | number | unknown {
  switch (setting.valueType) {
    case 'boolean':
      return setting.value === 'true';
    case 'number':
      return Number(setting.value);
    case 'json':
      try { return JSON.parse(setting.value); } catch { return setting.value; }
    default:
      return setting.value;
  }
}

/** Retourne un dictionnaire clé→valeur typée. */
export function settingsToMap(settings: PlatformSetting[]): Record<string, string | boolean | number | unknown> {
  return Object.fromEntries(settings.map((s) => [s.key, parseSetting(s)]));
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** GET /admin/overview — métriques globales (requiert superadmin). */
export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => apiRequest<AdminOverview>('/admin/overview'),
    staleTime: 30_000,
  });
}

/**
 * GET /admin/settings — liste complète des platform_settings.
 * Route publique : pas de JWT requis, appel via fetch brut.
 */
export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Erreur chargement settings');
      return res.json() as Promise<PlatformSetting[]>;
    },
    staleTime: 60_000,
  });
}

/** PATCH /admin/settings — mettre à jour une ou plusieurs settings. */
export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, string>) =>
      apiRequest<{ updated: number }>('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}

/** POST /admin/settings/logo — upload du logo (multipart). */
export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const { useAuthStore } = await import('@/store/auth.store');
      const token = useAuthStore.getState().token;
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/settings/logo', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText })) as { message?: string };
        throw new Error(body.message ?? res.statusText);
      }
      return res.json() as Promise<{ logoUrl: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}
