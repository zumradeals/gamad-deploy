// C-08 — PaymentProvider (abstraction, GeniusPay en première implémentation)
// BillingService ne connaît que cette interface, jamais GeniusPay directement (INV-09).
// Idempotence : une notification rejouée n'active pas deux fois (INV-07).
// Chaque transaction est figée en INSERT-only (C-11).

export interface InitParams {
  amount: number;
  currency: string;
  /** Unique, garantit l'idempotence (INV-07). */
  reference: string;
  customer: { id: string; email?: string; phone?: string };
  return_url: string;
  notify_url: string;
  context: Record<string, string>;
}

export interface InitResult {
  payment_url: string;
  provider_session_id: string;
}

export interface PaymentEvent {
  reference: string;
  status: 'success' | 'failed' | 'pending';
  provider_session_id: string;
  /** true uniquement après vérification cryptographique. */
  verified: boolean;
}

export interface PaymentProvider {
  readonly name: string; // ex. "geniuspay"
  initTransaction(params: InitParams): Promise<InitResult>;
  verifyNotification(payload: unknown, signature: string): Promise<PaymentEvent>;
}
