import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { BillingInfo, Transaction } from './types';

export function useBillingInfo(orgId: string | null) {
  return useQuery({
    queryKey: ['orgs', orgId, 'billing'],
    queryFn: () => apiRequest<BillingInfo>(`/orgs/${orgId}/billing`),
    enabled: !!orgId,
  });
}

export function useTransactions(orgId: string | null, page = 1) {
  return useQuery({
    queryKey: ['orgs', orgId, 'transactions', page],
    queryFn: () => apiRequest<{ items: Transaction[]; total: number; pages: number }>(
      `/orgs/${orgId}/transactions?page=${page}&limit=10`,
    ),
    enabled: !!orgId,
  });
}

export function useCreateCheckout(orgId: string | null) {
  return useMutation({
    mutationFn: (planKey: string) =>
      apiRequest<{ checkoutUrl: string }>(`/orgs/${orgId}/billing/checkout`, {
        method: 'POST',
        body: JSON.stringify({ plan: planKey }),
      }),
  });
}
