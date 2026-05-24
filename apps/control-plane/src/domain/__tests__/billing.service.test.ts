import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from '../billing/billing.service';
import type { PaymentProviderPort } from '../billing/payment-provider.port';
import type { BillingRepositoryPort } from '../billing/billing-repository.port';
import type { RawWebhookNotification, PaymentEvent } from '@gamad/contracts';

function makeValidEvent(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    ourReference: 'ref-uuid-001',
    providerReference: 'geniuspay-ref-001',
    status: 'success',
    context: { org_id: 'org-uuid-1', subscription_id: 'sub-uuid-1', type: 'subscription' },
    verified: true,
    ...overrides,
  };
}

function makeNotification(): RawWebhookNotification {
  return {
    rawBody: Buffer.from('{"event":"payment.success","data":{}}'),
    signature: 'valid-sig',
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };
}

describe('BillingService.handleNotification', () => {
  let mockProvider: PaymentProviderPort;
  let mockRepo: BillingRepositoryPort;
  let service: BillingService;

  beforeEach(() => {
    mockProvider = {
      name: 'mock',
      initTransaction: vi.fn(),
      verifyNotification: vi.fn(),
    } as unknown as PaymentProviderPort;

    mockRepo = {
      createTransaction: vi.fn(),
      updateProviderSession: vi.fn(),
      completeIfPending: vi.fn(),
      activateSubscription: vi.fn(),
    } as unknown as BillingRepositoryPort;

    service = new BillingService(mockProvider, mockRepo);
  });

  it('active la subscription quand payment.success est reçu', async () => {
    vi.mocked(mockProvider.verifyNotification).mockReturnValue(makeValidEvent());
    vi.mocked(mockRepo.completeIfPending).mockResolvedValue(true);

    await service.handleNotification(makeNotification());

    expect(mockRepo.completeIfPending).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: 'org-uuid-1' }),
      'ref-uuid-001',
      'success',
      'success',
      'geniuspay-ref-001',
      expect.any(String),
    );
    expect(mockRepo.activateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: 'org-uuid-1' }),
      'sub-uuid-1',
    );
  });

  it('idempotence : payment.success reçu 2x → 1 seule activation (completeIfPending retourne false)', async () => {
    vi.mocked(mockProvider.verifyNotification).mockReturnValue(makeValidEvent());
    vi.mocked(mockRepo.completeIfPending).mockResolvedValue(false);

    await service.handleNotification(makeNotification());

    expect(mockRepo.activateSubscription).not.toHaveBeenCalled();
  });

  it('jamais d activation sans signature vérifiée (verifyNotification lève une exception)', async () => {
    vi.mocked(mockProvider.verifyNotification).mockImplementation(() => {
      throw new Error('signature invalide');
    });

    await expect(service.handleNotification(makeNotification())).rejects.toThrow('signature invalide');
    expect(mockRepo.completeIfPending).not.toHaveBeenCalled();
    expect(mockRepo.activateSubscription).not.toHaveBeenCalled();
  });

  it('pas d activation si payment.failed', async () => {
    vi.mocked(mockProvider.verifyNotification).mockReturnValue(makeValidEvent({ status: 'failed' }));
    vi.mocked(mockRepo.completeIfPending).mockResolvedValue(true);

    await service.handleNotification(makeNotification());

    expect(mockRepo.activateSubscription).not.toHaveBeenCalled();
  });
});

describe('découplage : BillingService n importe pas GeniusPay', () => {
  it('le fichier billing.service.ts ne contient pas "geniuspay"', async () => {
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const src = readFileSync(
      fileURLToPath(new URL('../billing/billing.service.ts', import.meta.url)),
      'utf8',
    );
    expect(src.toLowerCase()).not.toMatch(/geniuspay/);
  });
});
