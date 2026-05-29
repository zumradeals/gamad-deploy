import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BlueprintStatus = 'draft' | 'submitted' | 'under_review' | 'certified' | 'rejected';
export type TemplateCategory = 'web_app' | 'cms' | 'ecommerce' | 'stack' | 'data_tools' | 'devops';

export interface BlueprintSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: TemplateCategory;
  isComposed: boolean;
  status: BlueprintStatus;
  latestRevisionId: string | null;
  certifiedTemplateId: string | null;
  repoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintRevision {
  id: string;
  version: number;
  contractContent?: string;
  contentHash: string;
  createdAt: string;
}

export interface BlueprintComponent {
  id: string;
  componentTemplateId: string;
  order: number;
  configOverrides: Record<string, unknown> | null;
  name: string;
  slug: string;
  priceAmount: number;
}

export interface BlueprintDetail extends BlueprintSummary {
  latestRevision: BlueprintRevision | null;
  revisions: Omit<BlueprintRevision, 'contractContent'>[];
  components: BlueprintComponent[];
}

export interface ReferenceTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  tags: string[];
  priceAmount: number;
  contractContent: string | null;
  createdAt: string;
}

export interface CreateBlueprintPayload {
  name: string;
  description?: string;
  tags?: string[];
  category: TemplateCategory;
  isComposed?: boolean;
  contractContent?: string;
}

export interface UpdateBlueprintPayload {
  name?: string;
  description?: string;
  tags?: string[];
  contractContent?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useReferenceTemplates() {
  return useQuery({
    queryKey: ['studio', 'reference'],
    queryFn: () => apiRequest<ReferenceTemplate[]>('/studio/reference'),
    staleTime: 5 * 60_000,
  });
}

export function useBlueprints() {
  return useQuery({
    queryKey: ['studio', 'blueprints'],
    queryFn: () => apiRequest<BlueprintSummary[]>('/studio/blueprints'),
  });
}

export function useBlueprint(id: string | undefined) {
  return useQuery({
    queryKey: ['studio', 'blueprints', id],
    queryFn: () => apiRequest<BlueprintDetail>(`/studio/blueprints/${id}`),
    enabled: !!id,
  });
}

export function useCreateBlueprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBlueprintPayload) =>
      apiRequest<{ id: string; latestRevisionId: string | null }>('/studio/blueprints', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio', 'blueprints'] });
    },
  });
}

export function useUpdateBlueprint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateBlueprintPayload) =>
      apiRequest<{ id: string; newRevisionId: string | null }>(`/studio/blueprints/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio', 'blueprints', id] });
      void qc.invalidateQueries({ queryKey: ['studio', 'blueprints'] });
    },
  });
}

export function useSubmitBlueprint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ id: string; status: string }>(`/studio/blueprints/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio', 'blueprints', id] });
      void qc.invalidateQueries({ queryKey: ['studio', 'blueprints'] });
    },
  });
}

export function useAddComponent(blueprintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      componentTemplateId: string;
      order?: number;
      configOverrides?: Record<string, unknown>;
    }) =>
      apiRequest<{ id: string }>(`/studio/blueprints/${blueprintId}/components`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio', 'blueprints', blueprintId] });
    },
  });
}

export function useRemoveComponent(blueprintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (componentId: string) =>
      apiRequest<{ success: boolean }>(
        `/studio/blueprints/${blueprintId}/components/${componentId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio', 'blueprints', blueprintId] });
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  web_app:    'Application web',
  cms:        'CMS',
  ecommerce:  'E-commerce',
  stack:      'Stack composée',
  data_tools: 'Data & Outils',
  devops:     'DevOps',
};

export const STATUS_LABELS: Record<BlueprintStatus, string> = {
  draft:       'Brouillon',
  submitted:   'Soumis',
  under_review:'En review',
  certified:   'Certifié',
  rejected:    'Rejeté',
};

export const STATUS_CLASSES: Record<BlueprintStatus, string> = {
  draft:        'bg-[--surface-alt] text-[--text-muted]',
  submitted:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  certified:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ── AI Generator ──────────────────────────────────────────────────────────────

export interface GenerateTemplateParams {
  description: string;
  category: TemplateCategory;
  blueprintId?: string;
  referenceTemplates?: string[];
}

export interface GenerateTemplateResult {
  contractContent: string;
  explanation: string;
  tokensUsed: number;
}

export function useGenerateTemplate() {
  return useMutation<GenerateTemplateResult, Error, GenerateTemplateParams>({
    mutationFn: (params) =>
      apiRequest<GenerateTemplateResult>('/studio/generate', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  });
}

// ── GitHub Publisher ──────────────────────────────────────────────────────────

export interface PublishResult {
  userRepoUrl: string;
  gamadForkUrl: string | null;
}

export function usePublishBlueprint(blueprintId: string) {
  const qc = useQueryClient();
  return useMutation<PublishResult, Error, void>({
    mutationFn: () =>
      apiRequest<PublishResult>(`/studio/blueprints/${blueprintId}/publish`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blueprint', blueprintId] }),
  });
}
