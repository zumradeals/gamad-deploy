// Module global qui expose les adaptateurs d'infrastructure à toute l'application.
// @Global() est nécessaire car PipelineModule (module enfant) a besoin des ports
// (DbProviderPort, PipelineRepositoryPort, AgentPort) sans pouvoir les importer
// directement depuis AppModule (NestJS ne propage pas les providers vers les enfants).
import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { DbProviderPort } from '../orchestration/ports/db-provider.port';
import { PipelineRepositoryPort } from '../orchestration/ports/pipeline-repository.port';
import { AgentPort } from '../orchestration/ports/agent.port';
import { DbProviderStub } from '../orchestration/stubs/db-provider.stub';
import { PipelineRepositoryAdapter, DB_TOKEN } from './pipeline-repository.adapter';
import {
  AgentHttpAdapter,
  AGENT_BASE_URL_TOKEN,
  AGENT_TOKEN_TOKEN,
} from './agent-http.adapter';
import {
  AWAIT_HEALTH_INTERVAL_MS,
  AWAIT_HEALTH_MAX_ATTEMPTS,
} from '../orchestration/pipeline/pipeline.constants';

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: () => {
        const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
        return drizzle(pool);
      },
    },
    {
      provide: AGENT_BASE_URL_TOKEN,
      useValue: process.env['AGENT_BASE_URL'] ?? 'http://localhost:7500',
    },
    {
      provide: AGENT_TOKEN_TOKEN,
      useValue: process.env['AGENT_TOKEN'] ?? '',
    },
    { provide: PipelineRepositoryPort, useClass: PipelineRepositoryAdapter },
    {
      provide: AgentPort,
      useFactory: (baseUrl: string, token: string) => new AgentHttpAdapter(baseUrl, token),
      inject: [AGENT_BASE_URL_TOKEN, AGENT_TOKEN_TOKEN],
    },
    { provide: DbProviderPort, useClass: DbProviderStub },
    { provide: AWAIT_HEALTH_INTERVAL_MS, useValue: 5_000 },
    { provide: AWAIT_HEALTH_MAX_ATTEMPTS, useValue: 12 },
  ],
  exports: [
    DB_TOKEN,
    PipelineRepositoryPort,
    AgentPort,
    DbProviderPort,
    AWAIT_HEALTH_INTERVAL_MS,
    AWAIT_HEALTH_MAX_ATTEMPTS,
    AGENT_BASE_URL_TOKEN,
    AGENT_TOKEN_TOKEN,
  ],
})
export class AdaptersModule {}
