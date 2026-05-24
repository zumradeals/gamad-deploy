// Contrôleur webhook GeniusPay — Couche Delivery.
// Exclu de TenantMiddleware (pas de JWT dans les webhooks) — voir AppModule.configure().
// rawBody requis pour HMAC : NestFactory.create(AppModule, { rawBody: true }).
// Garde-fou A : JAMAIS de succès HTTP si la signature n'est pas vérifiée.

import {
  Controller,
  Post,
  Req,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { BillingService } from '../domain/billing/billing.service';

@Controller('webhooks')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('geniuspay')
  @HttpCode(200)
  async receiveWebhook(@Req() req: RawBodyRequest<Request>): Promise<void> {
    const rawBody = req.rawBody;
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    if (
      !rawBody ||
      typeof signature !== 'string' ||
      typeof timestamp !== 'string'
    ) {
      throw new UnauthorizedException('En-têtes ou corps manquants.');
    }

    try {
      await this.billing.handleNotification({ rawBody, signature, timestamp });
    } catch {
      // Garde-fou A : signature invalide ou timestamp périmé → 401 immédiat, sans détail.
      throw new UnauthorizedException('Webhook non autorisé.');
    }
  }
}
