import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { GeniusPayProvider } from '../genius-pay.provider';

const WHSEC = 'whsec_test_secret_key_for_unit_tests';
const API_KEY = 'test_api_key';
const API_SECRET = 'test_api_secret';

function makeNotification(
  payload: object,
  secret: string,
  options?: { timestamp?: string; corrupt?: boolean },
) {
  const now = Math.floor(Date.now() / 1000).toString();
  const timestamp = options?.timestamp ?? now;
  const rawBody = Buffer.from(JSON.stringify(payload));
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  const signature = options?.corrupt ? expected.slice(0, -2) + 'ff' : expected;
  return { rawBody, signature, timestamp };
}

const VALID_PAYLOAD = {
  event: 'payment.success',
  data: {
    reference: 'our-ref-uuid',
    payment_reference: 'geniuspay-ref-001',
    context: { org_id: 'org-uuid-1', subscription_id: 'sub-uuid-1', type: 'subscription' },
  },
};

describe('GeniusPayProvider.verifyNotification', () => {
  let provider: GeniusPayProvider;

  beforeEach(() => {
    provider = new GeniusPayProvider(API_KEY, API_SECRET, WHSEC);
  });

  it('accepte un webhook valide et retourne le PaymentEvent', () => {
    const notif = makeNotification(VALID_PAYLOAD, WHSEC);
    const event = provider.verifyNotification(notif);
    expect(event.verified).toBe(true);
    expect(event.ourReference).toBe('our-ref-uuid');
    expect(event.status).toBe('success');
    expect(event.context['org_id']).toBe('org-uuid-1');
  });

  it('rejette un payload altéré (corps modifié après signature)', () => {
    const notif = makeNotification(VALID_PAYLOAD, WHSEC);
    // Altère le corps après avoir calculé la signature
    const tampered = { rawBody: Buffer.from('{"tampered":true}'), signature: notif.signature, timestamp: notif.timestamp };
    expect(() => provider.verifyNotification(tampered)).toThrow('signature invalide');
  });

  it('rejette une signature falsifiée', () => {
    const notif = makeNotification(VALID_PAYLOAD, WHSEC, { corrupt: true });
    expect(() => provider.verifyNotification(notif)).toThrow('signature invalide');
  });

  it('rejette un timestamp vieux de plus de 5 minutes', () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const notif = makeNotification(VALID_PAYLOAD, WHSEC, { timestamp: oldTimestamp });
    expect(() => provider.verifyNotification(notif)).toThrow('timestamp périmé');
  });
});
