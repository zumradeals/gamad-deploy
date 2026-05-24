// Port Domain pour la persistance des paiements (INV-09).
// Classe abstraite pour l'injection NestJS — BillingService dépend de ce port uniquement.

import type { TenantContext } from '@gamad/contracts';

export interface NewTransaction {
  orgId: string;
  userId?: string;
  type: 'subscription' | 'template_purchase' | 'credits';
  amount: number;
  currency: string;
  reference: string;
}

export abstract class BillingRepositoryPort {
  /** Crée une transaction en statut 'pending'. Retourne l'id. */
  abstract createTransaction(ctx: TenantContext, data: NewTransaction): Promise<string>;

  /** Met à jour provider_session_id après initTransaction. */
  abstract updateProviderSession(ctx: TenantContext, txId: string, providerSessionId: string): Promise<void>;

  /**
   * Optimistic-lock : UPDATE WHERE status='pending'.
   * Retourne true si la mise à jour a eu lieu (1 ligne), false si déjà traitée (0 ligne).
   * Insère systématiquement dans payment_state_transitions (INV-04, C-11).
   */
  abstract completeIfPending(
    ctx: TenantContext,
    reference: string,
    toStatus: 'success' | 'failed',
    eventType: string,
    providerReference: string | undefined,
    payloadHash: string,
  ): Promise<boolean>;

  /** Active le subscription (pending → active) pour l'organisation. */
  abstract activateSubscription(ctx: TenantContext, subscriptionId: string): Promise<void>;
}
