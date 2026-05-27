// Service qui instancie le Worker BullMQ du pipeline.
// Route chaque job par job.name vers le processor correspondant.
// Une seule instance de worker par processus — conforme à l'architecture single-tenant VPS.
// Connexion Redis injectée via REDIS_CONNECTION pour permettre l'override dans les tests.

import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Injectable, Inject } from '@nestjs/common';
import { Worker } from 'bullmq';
import {
  PIPELINE_QUEUE,
  REDIS_CONNECTION,
  JobName,
  AWAIT_HEALTH_INTERVAL_MS,
  AWAIT_HEALTH_MAX_ATTEMPTS,
} from './pipeline/pipeline.constants';
import { ResolveSourceProcessor } from './processors/resolve-source.processor';
import { ProvisionDbProcessor } from './processors/provision-db.processor';
import { MigrateDataProcessor } from './processors/migrate-data.processor';
import { DispatchAgentProcessor } from './processors/dispatch-agent.processor';
import { AwaitHealthProcessor } from './processors/await-health.processor';

@Injectable()
export class PipelineWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    @Inject(ResolveSourceProcessor) private readonly resolveSource: ResolveSourceProcessor,
    @Inject(ProvisionDbProcessor) private readonly provisionDb: ProvisionDbProcessor,
    @Inject(MigrateDataProcessor) private readonly migrateData: MigrateDataProcessor,
    @Inject(DispatchAgentProcessor) private readonly dispatchAgent: DispatchAgentProcessor,
    @Inject(AwaitHealthProcessor) private readonly awaitHealth: AwaitHealthProcessor,
    @Inject(REDIS_CONNECTION) private readonly redisConn: { host: string; port: number },
  ) {}

  async onModuleInit(): Promise<void> {
    this.worker = new Worker(
      PIPELINE_QUEUE,
      async (job) => {
        switch (job.name) {
          case JobName.RESOLVE_SOURCE:
            return this.resolveSource.process(job);
          case JobName.PROVISION_DB:
            return this.provisionDb.process(job);
          case JobName.MIGRATE_DATA:
            return this.migrateData.process(job);
          case JobName.DISPATCH_AGENT:
            return this.dispatchAgent.process(job);
          case JobName.AWAIT_HEALTH:
            return this.awaitHealth.process(job);
          default:
            throw new Error(`Job inconnu dans le pipeline : ${job.name}`);
        }
      },
      { connection: this.redisConn, concurrency: 1 },
    );
    this.worker.on('error', (err) => console.error('[PipelineWorker] Redis error:', err));
    this.worker.on('failed', (job, err) =>
      console.error(`[PipelineWorker] job ${job?.name ?? '?'} failed:`, err.message),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.worker = null;
  }
}

// Valeurs par défaut AWAIT_HEALTH pour production — override dans les tests via module.
export const PRODUCTION_AWAIT_HEALTH_PROVIDERS = [
  { provide: AWAIT_HEALTH_INTERVAL_MS, useValue: 5_000 },
  { provide: AWAIT_HEALTH_MAX_ATTEMPTS, useValue: 12 },
];
