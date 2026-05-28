import { useMutation } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { NormalizePreviewResult, NormalizeCommitResult } from './types';

interface NormalizePreviewInput {
  repoUrl: string;
  branch: string;
  analysis?: {
    has_dockerfile: boolean;
    has_compose_file: boolean;
    has_gamad_json: boolean;
    detected_framework?: string;
  };
}

interface NormalizeCommitInput {
  draftId: string;
  repoUrl: string;
  branch: string;
  /** Jamais loggé (CLAUDE.md §8). */
  gitToken: string;
}

export function useNormalizePreview() {
  return useMutation({
    mutationFn: (input: NormalizePreviewInput) =>
      apiRequest<NormalizePreviewResult>('/normalize/preview', {
        method: 'POST',
        body: JSON.stringify({
          repo_url: input.repoUrl,
          branch: input.branch,
          ...(input.analysis ? { analysis: input.analysis } : {}),
        }),
      }),
  });
}

export function useNormalizeCommit() {
  return useMutation({
    mutationFn: (input: NormalizeCommitInput) =>
      apiRequest<NormalizeCommitResult>('/normalize/commit', {
        method: 'POST',
        body: JSON.stringify({
          draft_id: input.draftId,
          repo_url: input.repoUrl,
          branch: input.branch,
          git_token: input.gitToken,
        }),
      }),
  });
}
