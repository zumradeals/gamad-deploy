import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Server, ServerCreatedResult, ServerDetail, RegenerateTokenResponse } from './types';

export function useServers(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'servers'],
    queryFn: () => apiRequest<Server[]>(`/orgs/${orgId}/servers`),
    enabled: !!orgId,
  });
}

export function useServerDetail(serverId: string) {
  return useQuery({
    queryKey: ['servers', serverId],
    queryFn: () => apiRequest<ServerDetail>(`/servers/${serverId}`),
    enabled: !!serverId,
  });
}

interface CreateServerInput {
  name: string;
  host: string;
  port: number;
}

export function useCreateServer(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServerInput) =>
      apiRequest<ServerCreatedResult>(`/orgs/${orgId}/servers`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'servers'] }),
  });
}

export function useTestServerConnection(serverId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ latencyMs: number }>(`/servers/${serverId}/ping`, { method: 'POST' }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['servers', serverId] }),
  });
}

export function useRegenerateServerToken(serverId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<RegenerateTokenResponse>(`/servers/${serverId}/regenerate-token`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['servers', serverId] }),
  });
}
