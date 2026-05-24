import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Deployment, DeploymentDetail } from './types';

export function useDeployments(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'deployments'],
    queryFn: () => apiRequest<Deployment[]>(`/orgs/${orgId}/deployments?limit=10`),
    enabled: !!orgId,
    refetchInterval: 15_000,
  });
}

export function useDeployment(deploymentId: string) {
  return useQuery({
    queryKey: ['deployments', deploymentId],
    queryFn: () => apiRequest<DeploymentDetail>(`/deployments/${deploymentId}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RUNNING' || status === 'PENDING' ? 5_000 : false;
    },
  });
}

interface CreateDeploymentInput {
  orgId: string;
  repoUrl: string;
  branch: string;
  gitToken?: string;
  serverId: string;
  domain?: string;
  httpsEnabled: boolean;
}

export function useCreateDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDeploymentInput) =>
      apiRequest<Deployment>('/deployments', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['orgs', variables.orgId, 'deployments'] });
    },
  });
}

export function useRollback(deploymentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<void>(`/deployments/${deploymentId}/rollback`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deployments', deploymentId] });
    },
  });
}
