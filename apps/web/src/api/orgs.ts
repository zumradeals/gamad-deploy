import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { OrgStats, AuditEvent, Organisation } from './types';

export function useOrgs() {
  return useQuery({
    queryKey: ['orgs'],
    queryFn: () => apiRequest<Organisation[]>('/orgs'),
  });
}

export function useOrgStats(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'stats'],
    queryFn: () => apiRequest<OrgStats>(`/orgs/${orgId}/stats`),
    enabled: !!orgId,
  });
}

export function useAuditLog(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'audit-events'],
    queryFn: () => apiRequest<AuditEvent[]>(`/orgs/${orgId}/audit-events?limit=20`),
    enabled: !!orgId,
  });
}
