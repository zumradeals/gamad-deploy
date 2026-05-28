// Tests du chemin nominal des 5 processors.
// Prouve que chaque job :
//   - appelle le Domain (SourceResolverService / StateMachineService via PipelineJobRunner)
//   - persiste transition+log via le port (pas de règle métier réimplémentée dans le job)
//   - enchaîne le job suivant

import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { Job, Queue } from 'bullmq';
import type { RepoAnalysis } from '@gamad/contracts';
import { SourceResolverService } from '../../domain/index';
import { PipelineJobRunner } from '../processors/pipeline-job-runner';
import { ResolveSourceProcessor } from '../processors/resolve-source.processor';
import { ProvisionDbProcessor } from '../processors/provision-db.processor';
import { MigrateDataProcessor } from '../processors/migrate-data.processor';
import { DispatchAgentProcessor } from '../processors/dispatch-agent.processor';
import type { GithubOAuthTokenRepository } from '../../adapters/github-oauth-token.repository';
import { AwaitHealthProcessor } from '../processors/await-health.processor';
import { AgentStub } from '../stubs/agent.stub';
import { DbProviderStub } from '../stubs/db-provider.stub';
import { PipelineRepositoryStub } from '../stubs/pipeline-repository.stub';
import { JobName } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const DEPLOYMENT_ID = 'dep-00000000-0000-0000-0000-000000000001';
const ORG_ID = 'org-00000000-0000-0000-0000-000000000001';
const USER_ID = 'usr-00000000-0000-0000-0000-000000000001';

const REPO_ANALYSIS: RepoAnalysis = {
  repo_url: 'https://github.com/test/app',
  ref: { type: 'commit', value: 'abc1234' },
  commit_sha: 'abc1234567890abcdef',
  has_dockerfile: false,
  has_compose_file: true,
  has_gamad_json: false,
};

function mockJob(data: PipelineJobData): Job<PipelineJobData> {
  return { data } as unknown as Job<PipelineJobData>;
}

const SERVER_ID = 'srv-00000000-0000-0000-0000-000000000001';
const TENANT = { org_id: ORG_ID, user_id: USER_ID };

function baseJobData(): PipelineJobData {
  return { deploymentId: DEPLOYMENT_ID, orgId: ORG_ID, userId: USER_ID, serverId: SERVER_ID };
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

function makeRunner(repo: PipelineRepositoryStub, agent: AgentStub): PipelineJobRunner {
  return new PipelineJobRunner(repo, agent);
}

function makeQueue() {
  return { add: vi.fn().mockResolvedValue({}) } as unknown as Queue;
}

// ── resolve-source ────────────────────────────────────────────────────────────

describe('ResolveSourceProcessor', () => {
  let repo: PipelineRepositoryStub;
  let agent: AgentStub;
  let runner: PipelineJobRunner;
  let queue: ReturnType<typeof makeQueue>;

  beforeEach(() => {
    repo = new PipelineRepositoryStub().seed(DEPLOYMENT_ID, 'PENDING');
    agent = new AgentStub();
    runner = makeRunner(repo, agent);
    queue = makeQueue();
  });

  test('appelle SourceResolverService.resolve (Domain) et non une réimplémentation', async () => {
    let domainCallCount = 0;
    const spyResolver: SourceResolverService = {
      resolve: (a: RepoAnalysis) => {
        domainCallCount++;
        return new SourceResolverService().resolve(a);
      },
    } as unknown as SourceResolverService;

    const proc = new ResolveSourceProcessor(runner, spyResolver, queue);
    await proc.process(mockJob({ ...baseJobData(), repoAnalysis: REPO_ANALYSIS }));

    expect(domainCallCount).toBe(1);
  });

  test('transition PENDING → RUNNING enregistrée via transitionWithLog (atomique)', async () => {
    const proc = new ResolveSourceProcessor(runner, new SourceResolverService(), queue);
    await proc.process(mockJob({ ...baseJobData(), repoAnalysis: REPO_ANALYSIS }));

    expect(repo.transitions).toHaveLength(1);
    expect(repo.transitions[0]).toMatchObject({ from: 'PENDING', to: 'RUNNING', step: JobName.RESOLVE_SOURCE });
    expect(repo.logs.some((l) => l.step === JobName.RESOLVE_SOURCE)).toBe(true);
  });

  test('PDN persisté dans le repository', async () => {
    const proc = new ResolveSourceProcessor(runner, new SourceResolverService(), queue);
    await proc.process(mockJob({ ...baseJobData(), repoAnalysis: REPO_ANALYSIS }));

    const pdn = await repo.getPlan(DEPLOYMENT_ID);
    expect(pdn).not.toBeNull();
    expect(pdn?.pdn_version).toBe('1.0');
    expect(pdn?.artifact.kind).toBe('docker-compose');
  });

  test('enchaîne provision-db dans la queue', async () => {
    const proc = new ResolveSourceProcessor(runner, new SourceResolverService(), queue);
    await proc.process(mockJob({ ...baseJobData(), repoAnalysis: REPO_ANALYSIS }));

    expect(queue.add).toHaveBeenCalledWith(JobName.PROVISION_DB, expect.objectContaining({ deploymentId: DEPLOYMENT_ID }), expect.any(Object));
  });
});

// ── provision-db ──────────────────────────────────────────────────────────────

describe('ProvisionDbProcessor', () => {
  let repo: PipelineRepositoryStub;
  let agent: AgentStub;
  let dbProvider: DbProviderStub;
  let queue: ReturnType<typeof makeQueue>;

  beforeEach(() => {
    repo = new PipelineRepositoryStub().seed(DEPLOYMENT_ID, 'RUNNING');
    agent = new AgentStub();
    dbProvider = new DbProviderStub();
    queue = makeQueue();
  });

  test('appelle DbProviderPort.provision (port, pas de logique métier interne)', async () => {
    const runner = makeRunner(repo, agent);
    const proc = new ProvisionDbProcessor(runner, dbProvider, queue);
    await proc.process(mockJob(baseJobData()));

    expect(dbProvider.provisions).toContain(DEPLOYMENT_ID);
  });

  test('enchaîne migrate-data dans la queue', async () => {
    const runner = makeRunner(repo, agent);
    const proc = new ProvisionDbProcessor(runner, dbProvider, queue);
    await proc.process(mockJob(baseJobData()));

    expect(queue.add).toHaveBeenCalledWith(JobName.MIGRATE_DATA, expect.any(Object), expect.any(Object));
  });
});

// ── migrate-data ──────────────────────────────────────────────────────────────

describe('MigrateDataProcessor', () => {
  test('appelle DbProviderPort.migrate et enchaîne dispatch-agent', async () => {
    const repo = new PipelineRepositoryStub().seed(DEPLOYMENT_ID, 'RUNNING');
    const agent = new AgentStub();
    const dbProvider = new DbProviderStub();
    const queue = makeQueue();
    const runner = makeRunner(repo, agent);

    const proc = new MigrateDataProcessor(runner, dbProvider, queue);
    await proc.process(mockJob(baseJobData()));

    expect(dbProvider.migrations.some((m) => m.deploymentId === DEPLOYMENT_ID)).toBe(true);
    expect(queue.add).toHaveBeenCalledWith(JobName.DISPATCH_AGENT, expect.any(Object), expect.any(Object));
  });
});

// ── dispatch-agent ────────────────────────────────────────────────────────────

describe('DispatchAgentProcessor', () => {
  test('appelle AgentPort.dispatch avec le PDN et enchaîne await-health', async () => {
    const repo = new PipelineRepositoryStub()
      .seed(DEPLOYMENT_ID, 'RUNNING')
      .seedPlan(DEPLOYMENT_ID, new SourceResolverService().resolve(REPO_ANALYSIS));
    const agent = new AgentStub();
    const queue = makeQueue();
    const runner = makeRunner(repo, agent);

    const proc = new DispatchAgentProcessor(runner, agent, queue, { find: async () => null, upsert: async () => undefined, delete: async () => undefined } as unknown as GithubOAuthTokenRepository);
    await proc.process(mockJob(baseJobData()));

    expect(agent.dispatches).toHaveLength(1);
    expect(agent.dispatches[0]?.deploymentId).toBe(DEPLOYMENT_ID);
    expect(queue.add).toHaveBeenCalledWith(JobName.AWAIT_HEALTH, expect.any(Object), expect.any(Object));
  });
});

// ── await-health ──────────────────────────────────────────────────────────────

describe('AwaitHealthProcessor', () => {
  test('transition RUNNING → SUCCESS via Domain quand les checks passent (INV-03)', async () => {
    const pdn = new SourceResolverService().resolve(REPO_ANALYSIS);
    const repo = new PipelineRepositoryStub()
      .seed(DEPLOYMENT_ID, 'RUNNING')
      .seedPlan(DEPLOYMENT_ID, pdn);
    const agent = new AgentStub();
    agent.setHealthPassed(true);
    const runner = makeRunner(repo, agent);

    const proc = new AwaitHealthProcessor(runner, agent, 0, 3);
    await proc.process(mockJob(baseJobData()));

    expect(repo.transitions).toHaveLength(1);
    expect(repo.transitions[0]).toMatchObject({ from: 'RUNNING', to: 'SUCCESS' });
    expect(await repo.getDeploymentState(DEPLOYMENT_ID, TENANT)).toBe('SUCCESS');
  });

  test('appelle checkHealth depuis AgentPort (pas de logique de check dans le processor)', async () => {
    const pdn = new SourceResolverService().resolve(REPO_ANALYSIS);
    const repo = new PipelineRepositoryStub()
      .seed(DEPLOYMENT_ID, 'RUNNING')
      .seedPlan(DEPLOYMENT_ID, pdn);
    const agent = new AgentStub();
    agent.setHealthPassed(true);
    const runner = makeRunner(repo, agent);

    const proc = new AwaitHealthProcessor(runner, agent, 0, 3);
    await proc.process(mockJob(baseJobData()));

    expect(agent.healthChecks).toHaveLength(1);
    expect(agent.healthChecks[0]?.deploymentId).toBe(DEPLOYMENT_ID);
  });
});
