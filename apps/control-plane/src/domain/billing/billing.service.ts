// BillingService — Domain, couche métier paiement (C-08).
// Connaît UNIQUEMENT PaymentProviderPort et BillingRepositoryPort (INV-09).
// JAMAIS de référence au prestataire de paiement concret, fetch, ou Drizzle dans ce fichier.
// Garde-fous financiers : vérification HMAC avant toute action, idempotence via completeIfPending.

import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { TenantContext } from '@gamad/contracts';
import type { RawWebhookNotification } from '@gamad/contracts';
import type { PaymentProviderPort } from './payment-provider.port';
import type { BillingRepositoryPort } from './billing-repository.port';

export interface InitSubscriptionParams {
  amount: number;
  currency?: string;
  subscriptionId: string;
  planId: string;
  customer: { id: string; email?: string; phone?: string };
  returnUrl: string;
  notifyUrl: string;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly provider: PaymentProviderPort,
    private readonly repo: BillingRepositoryPort,
  ) {}

  async initSubscription(
    ctx: TenantContext,
    params: InitSubscriptionParams,
  ): Promise<{ paymentUrl: string }> {
    const reference = randomUUID();
    const currency = params.currency ?? 'XOF';

    const txId = await this.repo.createTransaction(ctx, {
      orgId: ctx.org_id,
      userId: ctx.user_id,
      type: 'subscription',
      amount: params.amount,
      currency,
      reference,
    });

    const result = await this.provider.initTransaction({
      amount: params.amount,
      currency,
      reference,
      customer: params.customer,
      return_url: params.returnUrl,
      notify_url: params.notifyUrl,
      context: {
        org_id: ctx.org_id,
        subscription_id: params.subscriptionId,
        plan_id: params.planId,
        tx_id: txId,
        type: 'subscription',
      },
    });

    await this.repo.updateProviderSession(ctx, txId, result.provider_session_id);

    return { paymentUrl: result.payment_url };
  }

  async handleNotification(notification: RawWebhookNotification): Promise<void> {
    // Garde-fou A : la vérification HMAC lève une exception si invalide ou timestamp > 5 min.
    const event = this.provider.verifyNotification(notification);

    const orgId = event.context['org_id'];
    if (!orgId) throw new Error('org_id absent du contexte webhook vérifié.');

    const subscriptionId = event.context['subscription_id'];
    const ctx: TenantContext = { org_id: orgId, user_id: orgId };

    const payloadHash = createHash('sha256').update(notification.rawBody).digest('hex');

    const toStatus: 'success' | 'failed' =
      event.status === 'success' ? 'success' : 'failed';

    // Garde-fou B : optimistic-lock — 2e appel retourne false, pas d'activation double.
    const updated = await this.repo.completeIfPending(
      ctx,
      event.ourReference,
      toStatus,
      event.status,
      event.providerReference,
      payloadHash,
    );

    if (!updated) return;

    if (event.status === 'success' && subscriptionId) {
      await this.repo.activateSubscription(ctx, subscriptionId);
    }
  }
}
