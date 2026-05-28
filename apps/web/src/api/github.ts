import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { GitHubOAuthStatus, GitHubRepo, GitHubForkResult } from './types';

export function useGitHubStatus() {
  return useQuery({
    queryKey: ['github', 'status'],
    queryFn: () => apiRequest<GitHubOAuthStatus>('/github/status'),
    staleTime: 30_000,
  });
}

export function useGitHubRepos(page = 1, enabled = true) {
  return useQuery({
    queryKey: ['github', 'repos', page],
    queryFn: () => apiRequest<GitHubRepo[]>(`/github/repos?page=${page}`),
    enabled,
    staleTime: 60_000,
  });
}

export function useGitHubAuthUrl() {
  return useMutation({
    mutationFn: () => apiRequest<{ url: string }>('/github/auth-url'),
  });
}

export function useGitHubFork() {
  return useMutation({
    mutationFn: (input: { owner: string; repo: string }) =>
      apiRequest<GitHubForkResult>('/github/repos/fork', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useGitHubDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ disconnected: true }>('/github/connection', { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['github', 'status'] });
    },
  });
}
