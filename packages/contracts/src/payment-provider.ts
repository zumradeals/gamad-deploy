// C-08 — PaymentProvider (abstraction, GeniusPay en première implémentation)
// BillingService ne connaît que cette interface, jamais GeniusPay directement (INV-09).
// Idempotence : une notification rejouée n'active pas deux fois (INV-07).
// Chaque transition est tracée en INSERT-only dans payment_state_transitions (C-11).

export interface InitParams {
  amount: number;
  currency: string;
  /** Clé d'idempotence (INV-07) — unique, générée par BillingService. */
  reference: string;
  customer: { id: string; email?: string; phone?: string };
  return_url: string;
  notify_url: string;
  /** Contexte opaque retourné tel quel dans le webhook — doit contenir org_id, subscription_id. */
  context: Record<string, string>;
}

export interface InitResult {
  payment_url: string;
  provider_session_id: string;
}

/** Brut du webhook HTTP avant parsing — le corps doit rester non-parsé pour le HMAC. */
export interface RawWebhookNotification {
  rawBody: Buffer;
  /** Valeur de l'en-tête X-Webhook-Signature. */
  signature: string;
  /** Valeur de l'en-tête X-Webhook-Timestamp (secondes Unix en string). */
  timestamp: string;
}

export interface PaymentEvent {
  /** Notre référence interne (INV-07 — ancre d'idempotence). */
  ourReference: string;
  /** Référence côté prestataire. */
  providerReference: string;
  status: 'success' | 'failed' | 'cancelled' | 'expired';
  /** Contexte retourné par le prestataire — contient org_id, subscription_id (HMAC vérifié). */
  context: Record<string, string>;
  /** Marqueur de vérification — ce champ n'existe QUE si la signature HMAC est authentique. */
  verified: true;
}

export interface PaymentProvider {
  readonly name: string;
  initTransaction(params: InitParams): Promise<InitResult>;
  /** Lève une exception si signature invalide ou timestamp > 5 min. */
  verifyNotification(notification: RawWebhookNotification): PaymentEvent;
}
