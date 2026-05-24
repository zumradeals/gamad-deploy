import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type {
  UserProfile,
  OrgSettings,
  OrgMember,
  NotificationPrefs,
  ApiKey,
  CreateApiKeyResponse,
} from './types';

// ── Profile ───────────────────────────────────────────────────────────────────

export function useProfileQuery() {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => apiRequest<UserProfile>('/users/me'),
  });
}

interface UpdateProfileInput {
  name?: string;
  language?: UserProfile['language'];
  theme?: UserProfile['theme'];
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiRequest<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify(input) }),
  });
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiRequest<void>('/users/me/change-password', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useRequestDataExport() {
  return useMutation({
    mutationFn: () => apiRequest<void>('/users/me/export', { method: 'POST' }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiRequest<void>('/users/me', { method: 'DELETE' }),
  });
}

// ── Organisation settings ─────────────────────────────────────────────────────

export function useOrgSettingsQuery(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'settings'],
    queryFn: () => apiRequest<OrgSettings>(`/orgs/${orgId}/settings`),
    enabled: !!orgId,
  });
}

export function useUpdateOrg(orgId: string | null) {
  return useMutation({
    mutationFn: (input: { name: string }) =>
      apiRequest<OrgSettings>(`/orgs/${orgId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
  });
}

export function useDeleteOrg(orgId: string | null) {
  return useMutation({
    mutationFn: () => apiRequest<void>(`/orgs/${orgId}`, { method: 'DELETE' }),
  });
}

// ── Members ───────────────────────────────────────────────────────────────────

export function useOrgMembers(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'members'],
    queryFn: () => apiRequest<OrgMember[]>(`/orgs/${orgId}/members`),
    enabled: !!orgId,
  });
}

export function useInviteMember(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: OrgMember['role'] }) =>
      apiRequest<void>(`/orgs/${orgId}/members`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'members'] }),
  });
}

export function useRevokeMember(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<void>(`/orgs/${orgId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'members'] }),
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function useNotificationsQuery(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'notifications'],
    queryFn: () => apiRequest<NotificationPrefs>(`/orgs/${orgId}/notifications`),
    enabled: !!orgId,
  });
}

export function useUpdateNotifications(orgId: string | null) {
  return useMutation({
    mutationFn: (input: Partial<NotificationPrefs>) =>
      apiRequest<NotificationPrefs>(`/orgs/${orgId}/notifications`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
  });
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export function useApiKeys(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'api-keys'],
    queryFn: () => apiRequest<ApiKey[]>(`/orgs/${orgId}/api-keys`),
    enabled: !!orgId,
  });
}

export function useCreateApiKey(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; scope: ApiKey['scope'] }) =>
      apiRequest<CreateApiKeyResponse>(`/orgs/${orgId}/api-keys`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'api-keys'] }),
  });
}

export function useRevokeApiKey(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      apiRequest<void>(`/orgs/${orgId}/api-keys/${keyId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orgs', orgId, 'api-keys'] }),
  });
}
