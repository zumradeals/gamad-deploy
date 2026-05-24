// Adaptateur GeniusPay — Couche Adapters (INV-09).
// Implémente PaymentProviderPort. Jamais importé par le Domain.
// Signature : HMAC-SHA256(timestamp + '.' + rawBody, whsec_secret) — hex encodé (BILLING-01).
// Anti-replay : rejet si |now - timestamp| > 300 secondes (Garde-fou D).
// Comparaison à temps constant via timingSafeEqual (Garde-fou A).

import { createHmac, timingSafeEqual } from 'crypto';
import type { InitParams, InitResult, RawWebhookNotification, PaymentEvent } from '@gamad/contracts';
import { PaymentProviderPort } from '../domain/billing/payment-provider.port';

const REPLAY_WINDOW_SECONDS = 300;
const GENIUSPAY_BASE_URL = 'https://pay.genius.ci/api/v1';

type GeniusPayWebhookPayload = {
  event: string;
  data: {
    reference: string;
    payment_reference: string;
    context: Record<string, string>;
  };
};

export class GeniusPayProvider extends PaymentProviderPort {
  override readonly name = 'geniuspay';

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly webhookSecret: string,
  ) {
    super();
  }

  override async initTransaction(params: InitParams): Promise<InitResult> {
    const res = await fetch(`${GENIUSPAY_BASE_URL}/merchant/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-API-Secret': this.apiSecret,
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        reference: params.reference,
        customer: params.customer,
        return_url: params.return_url,
        notify_url: params.notify_url,
        context: params.context,
      }),
    });

    if (!res.ok) {
      throw new Error(`GeniusPay initTransaction : ${res.status} ${await res.text()}`);
    }

    const body = await res.json() as { payment_url: string; session_id: string };
    return { payment_url: body.payment_url, provider_session_id: body.session_id };
  }

  override verifyNotification(notification: RawWebhookNotification): PaymentEvent {
    const { rawBody, signature, timestamp } = notification;

    // Garde-fou D : anti-replay 5 minutes
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
      throw new Error('Webhook rejeté : timestamp périmé ou invalide.');
    }

    // HMAC-SHA256(timestamp + '.' + rawBody) — BILLING-01 : encodage hex supposé
    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex');

    // Comparaison à temps constant (Garde-fou A)
    let receivedBuf: Buffer;
    try {
      receivedBuf = Buffer.from(signature, 'hex');
    } catch {
      throw new Error('Webhook rejeté : signature non-hex.');
    }
    const expectedBuf = Buffer.from(expected, 'hex');

    if (
      receivedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(receivedBuf, expectedBuf)
    ) {
      throw new Error('Webhook rejeté : signature invalide.');
    }

    const payload = JSON.parse(Buffer.from(rawBody).toString('utf8')) as GeniusPayWebhookPayload;

    return {
      ourReference: payload.data.reference,
      providerReference: payload.data.payment_reference,
      status: this.mapStatus(payload.event),
      context: payload.data.context ?? {},
      verified: true,
    };
  }

  private mapStatus(event: string): PaymentEvent['status'] {
    switch (event) {
      case 'payment.success': return 'success';
      case 'payment.failed': return 'failed';
      case 'payment.cancelled': return 'cancelled';
      case 'payment.expired': return 'expired';
      default: return 'failed';
    }
  }
}
