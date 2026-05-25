import type { MiddlewareConsumer } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { AdaptersModule } from './adapters/adapters.module';
import { GithubContractAdapter } from './adapters/github-contract.adapter';
import { GitWritePort } from './adapters/git-write.port';
import { DeploymentController } from './delivery/deployment.controller';
import { CallbackController } from './delivery/callback.controller';
import { ContractController } from './delivery/contract.controller';
import { BillingController } from './delivery/billing.controller';
import { HealthController } from './delivery/health.controller';
import { AuthController } from './delivery/auth.controller';
import { AuthService } from './delivery/auth.service';
import { BillingService } from './domain/billing/billing.service';
import { PaymentProviderPort } from './domain/billing/payment-provider.port';
import { BillingRepositoryPort } from './domain/billing/billing-repository.port';
import { GeniusPayProvider } from './adapters/genius-pay.provider';
import { BillingRepositoryAdapter } from './adapters/billing-repository.adapter';
import { EventsGateway } from './delivery/events.gateway';
import { DeploymentNotifierService } from './delivery/deployment-notifier.service';
import { DraftStoreService } from './delivery/draft-store.service';
import { ContractGeneratorService } from './domain/contract-generator/contract-generator.service';
import { TenantMiddleware } from './persistence/tenant-middleware';

@Module({
  imports: [AdaptersModule, OrchestrationModule],
  controllers: [DeploymentController, CallbackController, ContractController, BillingController, HealthController, AuthController],
  providers: [
    // ── Ports → Adaptateurs (C-13 ContractGenerator) ─────────────────────────
    { provide: GitWritePort, useClass: GithubContractAdapter },
    // ── Ports → Adaptateurs (billing) ───────────────────────────────────────
    BillingService,
    { provide: BillingRepositoryPort, useClass: BillingRepositoryAdapter },
    {
      provide: PaymentProviderPort,
      useFactory: () =>
        new GeniusPayProvider(
          process.env['GENIUSPAY_API_KEY'] ?? '',
          process.env['GENIUSPAY_API_SECRET'] ?? '',
          process.env['GENIUSPAY_WEBHOOK_SECRET'] ?? '',
        ),
    },
    // ── Domain ───────────────────────────────────────────────────────────────
    ContractGeneratorService,
    // ── Delivery ─────────────────────────────────────────────────────────────
    EventsGateway,
    DeploymentNotifierService,
    DraftStoreService,
    AuthService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude('agent/(.*)', 'webhooks/(.*)', 'auth/(.*)', 'health')
      .forRoutes('*');
  }
}
