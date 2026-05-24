// Adaptateur Drizzle pour BillingRepositoryPort (INV-09).
// Toutes les écritures passent par withTenantTx (INV-06, ADR-0005).
// completeIfPending : optimistic-lock UPDATE WHERE status='pending' (INV-07, Garde-fou B).

import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TenantContext } from '@gamad/contracts';
import {
  paymentTransactions,
  paymentStateTransitions,
  subscriptions,
  withTenantTx,
} from '@gamad/schema';
import { DB_TOKEN } from './pipeline-repository.adapter';
import { BillingRepositoryPort, type NewTransaction } from '../domain/billing/billing-repository.port';

@Injectable()
export class BillingRepositoryAdapter extends BillingRepositoryPort {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {
    super();
  }

  override async createTransaction(ctx: TenantContext, data: NewTransaction): Promise<string> {
    const [row] = await withTenantTx(this.db, ctx, (tx) =>
      tx
        .insert(paymentTransactions)
        .values({
          orgId: data.orgId,
          userId: data.userId ?? null,
          type: data.type,
          amount: data.amount,
          currency: data.currency,
          reference: data.reference,
          status: 'pending',
          provider: 'geniuspay',
        })
        .returning({ id: paymentTransactions.id }),
    );
    if (!row) throw new Error('Échec création transaction paiement.');
    return row.id;
  }

  override async updateProviderSession(
    ctx: TenantContext,
    txId: string,
    providerSessionId: string,
  ): Promise<void> {
    await withTenantTx(this.db, ctx, (tx) =>
      tx
        .update(paymentTransactions)
        .set({ providerSessionId })
        .where(eq(paymentTransactions.id, txId)),
    );
  }

  override async completeIfPending(
    ctx: TenantContext,
    reference: string,
    toStatus: 'success' | 'failed',
    eventType: string,
    providerReference: string | undefined,
    payloadHash: string,
  ): Promise<boolean> {
    return withTenantTx(this.db, ctx, async (tx) => {
      const updated = await tx
        .update(paymentTransactions)
        .set({
          status: toStatus,
          providerSessionId: providerReference ?? null,
          payloadHash,
        })
        .where(
          and(
            eq(paymentTransactions.reference, reference),
            eq(paymentTransactions.status, 'pending'),
          ),
        )
        .returning({
          id: paymentTransactions.id,
          orgId: paymentTransactions.orgId,
        });

      if (updated.length === 0) return false;

      const { id: transactionId, orgId } = updated[0]!;

      await tx.insert(paymentStateTransitions).values({
        transactionId,
        orgId,
        fromStatus: 'pending',
        toStatus,
        eventType,
        ourReference: reference,
        providerReference: providerReference ?? null,
        payloadHash,
      });

      return true;
    });
  }

  override async activateSubscription(ctx: TenantContext, subscriptionId: string): Promise<void> {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await withTenantTx(this.db, ctx, (tx) =>
      tx
        .update(subscriptions)
        .set({ status: 'active', currentPeriodEnd: periodEnd })
        .where(
          and(
            eq(subscriptions.id, subscriptionId),
            eq(subscriptions.status, 'pending'),
          ),
        ),
    );
  }
}
