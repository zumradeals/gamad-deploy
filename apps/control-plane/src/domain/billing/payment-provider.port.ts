// Port Domain pour le prestataire de paiement (INV-09, C-08).
// Classe abstraite pour l'injection NestJS — BillingService dépend de ce port uniquement.

import type { InitParams, InitResult, RawWebhookNotification, PaymentEvent } from '@gamad/contracts';

export abstract class PaymentProviderPort {
  abstract readonly name: string;
  abstract initTransaction(params: InitParams): Promise<InitResult>;
  abstract verifyNotification(notification: RawWebhookNotification): PaymentEvent;
}
