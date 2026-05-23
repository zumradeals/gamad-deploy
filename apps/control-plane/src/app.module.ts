// Module racine de l'application control-plane (P-05).
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
import { DbProviderStub } from './orchestration/stubs/db-provider.stub';
import { DeploymentController } from './delivery/deployment.controller';
import { CallbackController } from './delivery/callback.controller';
import { EventsGateway } from './delivery/events.gateway';
import { DeploymentNotifierService } from './delivery/deployment-notifier.service';
import { TenantMiddleware } from './persistence/tenant-middleware';
import {
  AWAIT_HEALTH_INTERVAL_MS,
  AWAIT_HEALTH_MAX_ATTEMPTS,
} from './orchestration/pipeline/pipeline.constants';

@Module({
  imports: [OrchestrationModule],
  controllers: [DeploymentController, CallbackController],
  providers: [
    // ── DB ───────────────────────────────────────────────────────────────────
    {
      provide: DB_TOKEN,
      useFactory: () => {
        const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
        return drizzle(pool);
      },
    },
    // ── Ports → Adaptateurs ──────────────────────────────────────────────────
    { provide: PipelineRepositoryPort, useClass: PipelineRepositoryAdapter },
    {
      provide: AgentPort,
      useFactory: (baseUrl: string, token: string) => new AgentHttpAdapter(baseUrl, token),
      inject: [AGENT_BASE_URL_TOKEN, AGENT_TOKEN_TOKEN],
    },
    // DbProviderPort : stub acceptable en P-05 (VPS-01 valide le vrai cas)
    { provide: DbProviderPort, useClass: DbProviderStub },
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
    // ── Delivery ─────────────────────────────────────────────────────────────
    EventsGateway,
    DeploymentNotifierService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    // TenantMiddleware appliqué sur toutes les routes sauf /agent/callback
    // (l'agent s'authentifie via agent_token, pas via JWT tenant).
    consumer
      .apply(TenantMiddleware)
      .exclude('agent/(.*)')
      .forRoutes('*');
  }
}
