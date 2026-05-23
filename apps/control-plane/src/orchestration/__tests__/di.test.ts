// Preuve que la dette NestJS DI de P-03 est soldée.
// Chaque processor est résolu depuis un TestingModule réel — sans instanciation manuelle.
// Si un @Inject() est manquant ou qu'une import type brise emitDecoratorMetadata,
// module.compile() lève une exception et le test échoue.

import { describe, test, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ProvisionDbProcessor } from '../processors/provision-db.processor';
import { MigrateDataProcessor } from '../processors/migrate-data.processor';
import { DispatchAgentProcessor } from '../processors/dispatch-agent.processor';
import { AwaitHealthProcessor } from '../processors/await-health.processor';
import { ResolveSourceProcessor } from '../processors/resolve-source.processor';
import { PipelineJobRunner } from '../processors/pipeline-job-runner';
import { PipelineRepositoryPort } from '../ports/pipeline-repository.port';
import { AgentPort } from '../ports/agent.port';
import { DbProviderPort } from '../ports/db-provider.port';
import { SourceResolverService } from '../../domain/index';
import { AgentStub } from '../stubs/agent.stub';
import { DbProviderStub } from '../stubs/db-provider.stub';
import { PipelineRepositoryStub } from '../stubs/pipeline-repository.stub';
import {
  PIPELINE_QUEUE_TOKEN,
  AWAIT_HEALTH_INTERVAL_MS,
  AWAIT_HEALTH_MAX_ATTEMPTS,
} from '../pipeline/pipeline.constants';

function mockQueue() {
  return { add: vi.fn().mockResolvedValue({}) };
}

function baseProviders(repo = new PipelineRepositoryStub(), agent = new AgentStub()) {
  return [
    { provide: PipelineRepositoryPort, useValue: repo },
    { provide: AgentPort, useValue: agent },
    { provide: PIPELINE_QUEUE_TOKEN, useValue: mockQueue() },
    PipelineJobRunner,
  ];
}

describe('NestJS DI : résolution réelle via TestingModule', () => {
  test('ProvisionDbProcessor résolu depuis le container', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
        { provide: DbProviderPort, useValue: new DbProviderStub() },
        ProvisionDbProcessor,
      ],
    }).compile();

    const proc = moduleRef.get(ProvisionDbProcessor);
    expect(proc).toBeInstanceOf(ProvisionDbProcessor);
  });

  test('MigrateDataProcessor résolu depuis le container', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
        { provide: DbProviderPort, useValue: new DbProviderStub() },
        MigrateDataProcessor,
      ],
    }).compile();

    const proc = moduleRef.get(MigrateDataProcessor);
    expect(proc).toBeInstanceOf(MigrateDataProcessor);
  });

  test('DispatchAgentProcessor résolu depuis le container', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
        DispatchAgentProcessor,
      ],
    }).compile();

    const proc = moduleRef.get(DispatchAgentProcessor);
    expect(proc).toBeInstanceOf(DispatchAgentProcessor);
  });

  test('AwaitHealthProcessor résolu depuis le container (tokens primitifs inclus)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
        { provide: AWAIT_HEALTH_INTERVAL_MS, useValue: 0 },
        { provide: AWAIT_HEALTH_MAX_ATTEMPTS, useValue: 3 },
        AwaitHealthProcessor,
      ],
    }).compile();

    const proc = moduleRef.get(AwaitHealthProcessor);
    expect(proc).toBeInstanceOf(AwaitHealthProcessor);
  });

  test('ResolveSourceProcessor résolu depuis le container', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
        { provide: SourceResolverService, useValue: new SourceResolverService() },
        ResolveSourceProcessor,
      ],
    }).compile();

    const proc = moduleRef.get(ResolveSourceProcessor);
    expect(proc).toBeInstanceOf(ResolveSourceProcessor);
  });
});
