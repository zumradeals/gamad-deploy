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
import { AgentHttpAdapter } from './agent-http.adapter';
import {
  AWAIT_HEALTH_INTERVAL_MS,
  AWAIT_HEALTH_MAX_ATTEMPTS,
} from '../orchestration/pipeline/pipeline.constants';
import { CONTROL_PLANE_URL } from './adapters.constants';

export { CONTROL_PLANE_URL } from './adapters.constants';

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
      provide: CONTROL_PLANE_URL,
      useFactory: () => {
        if (process.env['CONTROL_PLANE_URL']) return process.env['CONTROL_PLANE_URL'];
        if (process.env['DOMAIN']) return `https://${process.env['DOMAIN']}/api`;
        return 'http://control-plane:3000';
      },
    },
    { provide: PipelineRepositoryPort, useClass: PipelineRepositoryAdapter },
    { provide: AgentPort, useClass: AgentHttpAdapter },
    { provide: DbProviderPort, useClass: DbProviderStub },
    { provide: AWAIT_HEALTH_INTERVAL_MS, useValue: 5_000 },
    // 72 × 5 s = 6 min — laisse le temps au docker build de se terminer sur VPS froid.
    { provide: AWAIT_HEALTH_MAX_ATTEMPTS, useValue: 72 },
  ],
  exports: [
    DB_TOKEN,
    CONTROL_PLANE_URL,
    PipelineRepositoryPort,
    AgentPort,
    DbProviderPort,
    AWAIT_HEALTH_INTERVAL_MS,
    AWAIT_HEALTH_MAX_ATTEMPTS,
  ],
})
export class AdaptersModule {}
