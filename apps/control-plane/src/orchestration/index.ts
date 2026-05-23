// Couche Orchestration — pipeline BullMQ + Redis (P-03+)
// Enchaîne les étapes de façon idempotente (INV-07) et traçable (C-11).
// Importe Domain et Adapters (jamais Delivery — CLAUDE.md §4).

export { OrchestrationModule } from './orchestration.module';
export { PipelineModule } from './pipeline.module';
export { PipelineJobRunner } from './processors/pipeline-job-runner';
export { ResolveSourceProcessor } from './processors/resolve-source.processor';
export { ProvisionDbProcessor } from './processors/provision-db.processor';
export { MigrateDataProcessor } from './processors/migrate-data.processor';
export { DispatchAgentProcessor } from './processors/dispatch-agent.processor';
export { AwaitHealthProcessor } from './processors/await-health.processor';
export { AgentPort } from './ports/agent.port';
export { DbProviderPort } from './ports/db-provider.port';
export { PipelineRepositoryPort } from './ports/pipeline-repository.port';
export { AgentStub } from './stubs/agent.stub';
export { DbProviderStub } from './stubs/db-provider.stub';
export { PipelineRepositoryStub } from './stubs/pipeline-repository.stub';
export { JobName, PIPELINE_QUEUE } from './pipeline/pipeline.constants';
export type { PipelineJobData } from './pipeline/pipeline.types';
