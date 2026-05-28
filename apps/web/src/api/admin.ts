// Hooks React Query pour le dashboard superadmin (Phase 1 + Phase 2).
// GET /admin/settings est public (sans JWT) — appel direct via fetch.
// Les autres endpoints nécessitent un JWT superadmin.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

// ── Types Phase 1 ─────────────────────────────────────────────────────────────

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

// ── Types Phase 2 ─────────────────────────────────────────────────────────────

export interface AdminUserSummary {
  id: string;
  email: string;
  fullName: string | null;
  platformRole: 'superadmin' | 'support' | 'user' | null;
  suspendedAt: string | null;
  createdAt: string;
  orgsCount: number;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  fullName: string | null;
  platformRole: 'superadmin' | 'support' | 'user' | null;
  suspendedAt: string | null;
  createdAt: string;
  orgs: Array<{ id: string; name: string; orgRole: string }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminOrgSummary {
  id: string;
  name: string;
  slug: string;
  planName: string | null;
  membersCount: number;
  projectsCount: number;
  serversCount: number;
  createdAt: string;
}

export interface AdminOrgDetail {
  id: string;
  name: string;
  slug: string;
  plan: { id: string; name: string } | null;
  members: Array<{ userId: string; email: string; fullName: string | null; orgRole: string }>;
  stats: { projectsCount: number; serversCount: number; deploymentsCount: number };
}

export interface AdminPlan {
  id: string;
  name: string;
  slug: string;
  priceAmount: number;
  currency: string;
  isActive: boolean;
  limits: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlanBody {
  name: string;
  slug?: string;
  priceAmount: number;
  currency?: string;
  isActive?: boolean;
  limits: {
    max_projects?: number;
    max_servers?: number;
    max_deployments_month?: number;
    [key: string]: unknown;
  };
}

export interface AdminTemplateSummary {
  id: string;
  name: string;
  level: 'draft' | 'valid' | 'certified';
  authorEmail: string | null;
  usageCount: number;
  createdAt: string;
}

// ── Helpers Phase 1 ───────────────────────────────────────────────────────────

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

// ── Hooks Phase 1 ─────────────────────────────────────────────────────────────

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

// ── Hooks Phase 2 — Utilisateurs ─────────────────────────────────────────────

/** GET /admin/users — liste paginée. */
export function useAdminUsers(params: { page?: number; limit?: number; search?: string } = {}) {
  const { page = 1, limit = 20, search = '' } = params;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
  });
  return useQuery({
    queryKey: ['admin', 'users', page, limit, search],
    queryFn: () => apiRequest<PaginatedResponse<AdminUserSummary>>(`/admin/users?${qs}`),
    staleTime: 15_000,
  });
}

/** GET /admin/users/:id — détail. */
export function useAdminUserDetail(id: string) {
  return useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => apiRequest<AdminUserDetail>(`/admin/users/${id}`),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

/** PATCH /admin/users/:id/role */
export function useChangeUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'superadmin' | 'support' | 'user' }) =>
      apiRequest<{ userId: string; role: string }>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
  });
}

/** PATCH /admin/users/:id/suspend */
export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      apiRequest<{ userId: string; suspended: boolean; suspendedAt: string | null }>(
        `/admin/users/${id}/suspend`,
        { method: 'PATCH', body: JSON.stringify({ suspend }) },
      ),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
  });
}

/** POST /admin/users/:id/impersonate */
export function useImpersonateUser() {
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ token: string; expiresAt: string }>(`/admin/users/${id}/impersonate`, {
        method: 'POST',
      }),
  });
}

// ── Hooks Phase 2 — Organisations ─────────────────────────────────────────────

/** GET /admin/orgs — liste paginée. */
export function useAdminOrgs(params: { page?: number; limit?: number; search?: string } = {}) {
  const { page = 1, limit = 20, search = '' } = params;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
  });
  return useQuery({
    queryKey: ['admin', 'orgs', page, limit, search],
    queryFn: () => apiRequest<PaginatedResponse<AdminOrgSummary>>(`/admin/orgs?${qs}`),
    staleTime: 15_000,
  });
}

/** GET /admin/orgs/:id — détail. */
export function useAdminOrgDetail(id: string) {
  return useQuery({
    queryKey: ['admin', 'orgs', id],
    queryFn: () => apiRequest<AdminOrgDetail>(`/admin/orgs/${id}`),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

/** PATCH /admin/orgs/:id/plan */
export function useChangeOrgPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, planId }: { id: string; planId: string }) =>
      apiRequest<{ orgId: string; planId: string; planName: string }>(
        `/admin/orgs/${id}/plan`,
        { method: 'PATCH', body: JSON.stringify({ planId }) },
      ),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'orgs', id] });
    },
  });
}

// ── Hooks Phase 2 — Plans ─────────────────────────────────────────────────────

/** GET /admin/plans */
export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => apiRequest<AdminPlan[]>('/admin/plans'),
    staleTime: 30_000,
  });
}

/** POST /admin/plans */
export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminPlanBody) =>
      apiRequest<AdminPlan>('/admin/plans', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });
}

/** PATCH /admin/plans/:id */
export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<AdminPlanBody>) =>
      apiRequest<AdminPlan>(`/admin/plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });
}

/** DELETE /admin/plans/:id (désactivation) */
export function useDeactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ planId: string; isActive: false }>(`/admin/plans/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });
}

// ── Hooks Phase 2 — Templates ─────────────────────────────────────────────────

/** GET /admin/templates */
export function useAdminTemplates() {
  return useQuery({
    queryKey: ['admin', 'templates'],
    queryFn: () =>
      apiRequest<{ data: AdminTemplateSummary[] }>('/admin/templates').then((r) => r.data),
    staleTime: 15_000,
  });
}

/** PATCH /admin/templates/:id/status */
export function useChangeTemplateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'valid' | 'certified' }) =>
      apiRequest<{ templateId: string; previousLevel: string; newLevel: string }>(
        `/admin/templates/${id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
  });
}
