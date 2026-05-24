// Module racine de l'application control-plane (P-05 + P-06).
// Câble : OrchestrationModule (BullMQ + processors) + adaptateurs réels + couche Delivery.
// Les ports abstraits sont résolus ici via les adaptateurs concrets (INV-09).

import { Module, MiddlewareConsumer } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { PipelineRepositoryPort } from './orchestration/ports/pipeline-repository.port';
import { AgentPort } from './orchestration/ports/agent.port';
import { DbProviderPort } from './orchestration/ports/db-provider.port';
import { PipelineRepositoryAdapter, DB_TOKEN } from './adapters/pipeline-repository.adapter';
import {
  AgentHttpAdapter,
  AGENT_BASE_URL_TOKEN,
  AGENT_TOKEN_TOKEN,
} from './adapters/agent-http.adapter';
import { GithubContractAdapter } from './adapters/github-contract.adapter';
import { GitWritePort } from './adapters/git-write.port';
import { DbProviderStub } from './orchestration/stubs/db-provider.stub';
import { DeploymentController } from './delivery/deployment.controller';
import { CallbackController } from './delivery/callback.controller';
import { ContractController } from './delivery/contract.controller';
import { BillingController } from './delivery/billing.controller';
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
import {
  AWAIT_HEALTH_INTERVAL_MS,
  AWAIT_HEALTH_MAX_ATTEMPTS,
} from './orchestration/pipeline/pipeline.constants';

@Module({
  imports: [OrchestrationModule],
  controllers: [DeploymentController, CallbackController, ContractController, BillingController],
  providers: [
    // ── DB ───────────────────────────────────────────────────────────────────
    {
      provide: DB_TOKEN,
      useFactory: () => {
        const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
        return drizzle(pool);
      },
    },
    // ── Ports → Adaptateurs (pipeline) ──────────────────────────────────────
    { provide: PipelineRepositoryPort, useClass: PipelineRepositoryAdapter },
    {
      provide: AgentPort,
      useFactory: (baseUrl: string, token: string) => new AgentHttpAdapter(baseUrl, token),
      inject: [AGENT_BASE_URL_TOKEN, AGENT_TOKEN_TOKEN],
    },
    { provide: DbProviderPort, useClass: DbProviderStub },
    // ── Ports → Adaptateurs (C-13 ContractGenerator) ─────────────────────────
    { provide: GitWritePort, useClass: GithubContractAdapter },
    // ── Tokens de configuration ───────────────────────────────────────────────
    {
      provide: AGENT_BASE_URL_TOKEN,
      useValue: process.env['AGENT_BASE_URL'] ?? 'http://localhost:7500',
    },
    {
      provide: AGENT_TOKEN_TOKEN,
      useValue: process.env['AGENT_TOKEN'] ?? '',
    },
    { provide: AWAIT_HEALTH_INTERVAL_MS, useValue: 5_000 },
    { provide: AWAIT_HEALTH_MAX_ATTEMPTS, useValue: 12 },
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
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude('agent/(.*)', 'webhooks/(.*)')
      .forRoutes('*');
  }
}
