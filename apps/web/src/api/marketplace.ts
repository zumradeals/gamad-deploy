import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MarketplaceLevel = 'draft' | 'valid' | 'certified';

export interface MarketplaceTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  tags: string[];
  priceAmount: number;
  currency: string;
  repoUrl: string;
  marketplaceLevel: MarketplaceLevel;
  ownerOrgName: string;
  usageCount: number;
  createdAt: string;
}

export interface MarketplaceTemplateDetail extends MarketplaceTemplate {
  hasAccess: boolean;
}

export interface OrgTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  tags: string[];
  priceAmount: number;
  marketplaceLevel: MarketplaceLevel;
  isPublished: boolean;
  repoUrl: string;
  usageCount: number;
  createdAt: string;
}

export interface PurchaseResult {
  deploymentId?: string;
  paymentUrl?: string;
}

export interface DeployResult {
  deploymentId: string;
}

export interface CreateTemplatePayload {
  name: string;
  slug: string;
  repoUrl: string;
  description?: string;
  tags?: string[];
  priceAmount?: number;
}

export interface UpdateTemplatePayload {
  name?: string;
  description?: string;
  tags?: string[];
  priceAmount?: number;
  isPublished?: boolean;
}

export interface MarketplaceFilters {
  search?: string;
  freeOnly?: boolean;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** GET /marketplace — catalogue public des templates certifiés */
export function useMarketplace(filters?: MarketplaceFilters) {
  return useQuery({
    queryKey: ['marketplace', filters],
    queryFn: async () => {
      const all = await apiRequest<MarketplaceTemplate[]>('/marketplace');
      if (!filters) return all;
      return all.filter((t) => {
        if (filters.freeOnly && t.priceAmount !== 0) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          return (
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
          );
        }
        return true;
      });
    },
    staleTime: 60_000,
  });
}

/** GET /marketplace/:slug — détail d'un template + hasAccess */
export function useMarketplaceTemplate(slug: string | undefined) {
  return useQuery({
    queryKey: ['marketplace', 'detail', slug],
    queryFn: () => apiRequest<MarketplaceTemplateDetail>(`/marketplace/${slug}`),
    enabled: !!slug,
  });
}

/** POST /marketplace/:id/purchase */
export function usePurchaseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      serverId,
      domain,
      httpsEnabled,
    }: {
      id: string;
      serverId: string;
      domain?: string;
      httpsEnabled: boolean;
    }) =>
      apiRequest<PurchaseResult>(`/marketplace/${id}/purchase`, {
        method: 'POST',
        body: JSON.stringify({ serverId, domain, httpsEnabled }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

/** POST /marketplace/:id/deploy */
export function useDeployTemplate() {
  return useMutation({
    mutationFn: ({
      id,
      serverId,
      domain,
      httpsEnabled,
    }: {
      id: string;
      serverId: string;
      domain?: string;
      httpsEnabled: boolean;
    }) =>
      apiRequest<DeployResult>(`/marketplace/${id}/deploy`, {
        method: 'POST',
        body: JSON.stringify({ serverId, domain, httpsEnabled }),
      }),
  });
}

/** GET /orgs/:orgId/templates */
export function useOrgTemplates(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'templates'],
    queryFn: () => apiRequest<OrgTemplate[]>(`/orgs/${orgId}/templates`),
    enabled: !!orgId,
  });
}

/** POST /orgs/:orgId/templates */
export function useSubmitTemplate(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) =>
      apiRequest<{ id: string; name: string; slug: string; marketplaceLevel: string }>(
        `/orgs/${orgId}/templates`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'templates'] });
    },
  });
}

/** PATCH /orgs/:orgId/templates/:id */
export function useUpdateOrgTemplate(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateTemplatePayload & { id: string }) =>
      apiRequest<OrgTemplate>(`/orgs/${orgId}/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'templates'] });
    },
  });
}

/** DELETE /orgs/:orgId/templates/:id */
export function useDeleteOrgTemplate(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ success: boolean }>(`/orgs/${orgId}/templates/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'templates'] });
    },
  });
}
