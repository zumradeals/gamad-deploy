// Module BullMQ de l'orchestration (P-03).
// Enregistre la queue pipeline + les 5 processors + PipelineJobRunner.
// La connexion Redis est injectée via le module parent (OrchestrationModule).
// Les ports (AgentPort, DbProviderPort, PipelineRepositoryPort) sont fournis en dehors
// de ce module (par OrchestrationModule ou les tests) via les abstract classes comme tokens.

import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PIPELINE_QUEUE, PIPELINE_QUEUE_TOKEN } from './pipeline/pipeline.constants';
import { PipelineJobRunner } from './processors/pipeline-job-runner';
import { ResolveSourceProcessor } from './processors/resolve-source.processor';
import { ProvisionDbProcessor } from './processors/provision-db.processor';
import { MigrateDataProcessor } from './processors/migrate-data.processor';
import { DispatchAgentProcessor } from './processors/dispatch-agent.processor';
import { AwaitHealthProcessor } from './processors/await-health.processor';
import { SourceResolverService } from '../domain/index';
import { GithubOAuthTokenRepository } from '../adapters/github-oauth-token.repository';

@Module({
  imports: [
    BullModule.registerQueue({ name: PIPELINE_QUEUE }),
  ],
  providers: [
    SourceResolverService,
    GithubOAuthTokenRepository,
    PipelineJobRunner,
    ResolveSourceProcessor,
    ProvisionDbProcessor,
    MigrateDataProcessor,
    DispatchAgentProcessor,
    AwaitHealthProcessor,
    {
      provide: PIPELINE_QUEUE_TOKEN,
      useFactory: (queue: Queue) => queue,
      inject: [getQueueToken(PIPELINE_QUEUE)],
    },
  ],
  exports: [
    PipelineJobRunner,
    ResolveSourceProcessor,
    ProvisionDbProcessor,
    MigrateDataProcessor,
    DispatchAgentProcessor,
    AwaitHealthProcessor,
    PIPELINE_QUEUE_TOKEN,
  ],
})
export class PipelineModule {}
