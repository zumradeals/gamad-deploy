// Module BullMQ de l'orchestration (P-03).
// Enregistre la queue pipeline + les 5 processors + PipelineJobRunner.
// La connexion Redis est injectée via le module parent (OrchestrationModule).
// Les ports (AgentPort, DbProviderPort, PipelineRepositoryPort) sont fournis en dehors
// de ce module (par OrchestrationModule ou les tests) via les abstract classes comme tokens.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PIPELINE_QUEUE } from './pipeline/pipeline.constants';
import { PipelineJobRunner } from './processors/pipeline-job-runner';
import { ResolveSourceProcessor } from './processors/resolve-source.processor';
import { ProvisionDbProcessor } from './processors/provision-db.processor';
import { MigrateDataProcessor } from './processors/migrate-data.processor';
import { DispatchAgentProcessor } from './processors/dispatch-agent.processor';
import { AwaitHealthProcessor } from './processors/await-health.processor';
import { SourceResolverService } from '../domain/index';

@Module({
  imports: [
    BullModule.registerQueue({ name: PIPELINE_QUEUE }),
  ],
  providers: [
    SourceResolverService,
    PipelineJobRunner,
    ResolveSourceProcessor,
    ProvisionDbProcessor,
    MigrateDataProcessor,
    DispatchAgentProcessor,
    AwaitHealthProcessor,
  ],
  exports: [
    PipelineJobRunner,
    ResolveSourceProcessor,
    ProvisionDbProcessor,
    MigrateDataProcessor,
    DispatchAgentProcessor,
    AwaitHealthProcessor,
  ],
})
export class PipelineModule {}
