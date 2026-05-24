import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Project, AnalysisResult } from './types';

export function useProjects(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'projects'],
    queryFn: () => apiRequest<Project[]>(`/orgs/${orgId}/projects`),
    enabled: !!orgId,
  });
}

interface AnalyzeRepoInput {
  repoUrl: string;
  branch: string;
  gitToken?: string;
}

export function useAnalyzeRepo(orgId: string | null) {
  return useMutation({
    mutationFn: (input: AnalyzeRepoInput) =>
      apiRequest<AnalysisResult>(`/orgs/${orgId}/projects/analyze`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}
