import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Server } from './types';

export function useServers(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'servers'],
    queryFn: () => apiRequest<Server[]>(`/orgs/${orgId}/servers`),
    enabled: !!orgId,
  });
}

interface CreateServerInput {
  name: string;
  host: string;
  port: number;
  agentToken: string;
}

export function useCreateServer(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServerInput) =>
      apiRequest<Server>(`/orgs/${orgId}/servers`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'servers'] });
    },
  });
}
