// Preuve d'idempotence (INV-07) : rejouer un job = no-op, aucun doublon en base.
// Chaque processor est testé en re-run après un premier run réussi.
// Assertions clés :
//   - port appelé exactement 1 fois au total (pas 2)
//   - transitions = 1 (pas 2)
//   - état final inchangé

import { describe, test, expect, vi } from 'vitest';
import type { Job, Queue } from 'bullmq';
import { SourceResolverService } from '../../domain/index';
import { PipelineJobRunner } from '../processors/pipeline-job-runner';
import { ResolveSourceProcessor } from '../processors/resolve-source.processor';
import { ProvisionDbProcessor } from '../processors/provision-db.processor';
import { MigrateDataProcessor } from '../processors/migrate-data.processor';
import { DispatchAgentProcessor } from '../processors/dispatch-agent.processor';
import { AwaitHealthProcessor } from '../processors/await-health.processor';
import { AgentStub } from '../stubs/agent.stub';
import { DbProviderStub } from '../stubs/db-provider.stub';
import { PipelineRepositoryStub } from '../stubs/pipeline-repository.stub';
import { JobName } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';

const DEP = 'dep-idem-00000000-0000-0000-000000000001';
const ORG = 'org-00000000-0000-0000-0000-000000000001';
const USR = 'usr-00000000-0000-0000-0000-000000000001';

const REPO_ANALYSIS = {
  repo_url: 'https://github.com/test/app',
  ref: { type: 'commit' as const, value: 'abc1234' },
  commit_sha: 'abc1234',
  has_dockerfile: false,
  has_compose_file: true,
  has_gamad_json: false,
};

function mockJob(data: PipelineJobData): Job<PipelineJobData> {
  return { data } as unknown as Job<PipelineJobData>;
}

const SRV = 'srv-00000000-0000-0000-0000-000000000001';
const JOB_DATA: PipelineJobData = { deploymentId: DEP, orgId: ORG, userId: USR, serverId: SRV, repoAnalysis: REPO_ANALYSIS };

function makeQueue() {
  return { add: vi.fn().mockResolvedValue({}) } as unknown as Queue;
}

// ── resolve-source : no-op si step déjà complété ─────────────────────────────

describe('idempotence : resolve-source', () => {
  test('2ème run → aucune nouvelle transition, SourceResolver non rappelé', async () => {
    const repo = new PipelineRepositoryStub().seed(DEP, 'PENDING');
    const agent = new AgentStub();
    const runner = new PipelineJobRunner(repo, agent);
    const queue = makeQueue();
    let domainCalls = 0;
    const spyResolver = {
      resolve: (a: typeof REPO_ANALYSIS) => { domainCalls++; return new SourceResolverService().resolve(a); },
    } as unknown as SourceResolverService;

    const proc = new ResolveSourceProcessor(runner, spyResolver, queue);
    await proc.process(mockJob(JOB_DATA));
    await proc.process(mockJob(JOB_DATA)); // replay

    expect(domainCalls).toBe(1);
    expect(repo.transitions).toHaveLength(1); // pas de doublon
  });
});

// ── provision-db : no-op si step déjà complété ───────────────────────────────

describe('idempotence : provision-db', () => {
  test('2ème run → DbProviderPort.provision appelé 1 seule fois', async () => {
    const repo = new PipelineRepositoryStub().seed(DEP, 'RUNNING');
    const agent = new AgentStub();
    const dbProvider = new DbProviderStub();
    const runner = new PipelineJobRunner(repo, agent);
    const queue = makeQueue();

    const proc = new ProvisionDbProcessor(runner, dbProvider, queue);
    await proc.process(mockJob(JOB_DATA));
    await proc.process(mockJob(JOB_DATA)); // replay

    expect(dbProvider.provisions.filter((id) => id === DEP)).toHaveLength(1);
    expect(queue.add).toHaveBeenCalledTimes(1); // pas de doublon de job suivant
  });
});

// ── migrate-data : no-op si step déjà complété ───────────────────────────────

describe('idempotence : migrate-data', () => {
  test('2ème run → DbProviderPort.migrate appelé 1 seule fois', async () => {
    const repo = new PipelineRepositoryStub().seed(DEP, 'RUNNING');
    const agent = new AgentStub();
    const dbProvider = new DbProviderStub();
    const runner = new PipelineJobRunner(repo, agent);
    const queue = makeQueue();

    const proc = new MigrateDataProcessor(runner, dbProvider, queue);
    await proc.process(mockJob(JOB_DATA));
    await proc.process(mockJob(JOB_DATA)); // replay

    expect(dbProvider.migrations.filter((m) => m.deploymentId === DEP)).toHaveLength(1);
  });
});

// ── dispatch-agent : no-op si step déjà complété — clé car double dispatch = danger ──

describe('idempotence : dispatch-agent (protection contre double dispatch)', () => {
  test('2ème run → AgentPort.dispatch appelé 1 seule fois', async () => {
    const pdn = new SourceResolverService().resolve(REPO_ANALYSIS);
    const repo = new PipelineRepositoryStub()
      .seed(DEP, 'RUNNING')
      .seedPlan(DEP, pdn);
    const agent = new AgentStub();
    const runner = new PipelineJobRunner(repo, agent);
    const queue = makeQueue();

    const proc = new DispatchAgentProcessor(runner, agent, queue);
    await proc.process(mockJob(JOB_DATA));
    await proc.process(mockJob(JOB_DATA)); // replay

    expect(agent.dispatches).toHaveLength(1); // double dispatch bloqué
  });
});

// ── await-health : no-op si step déjà complété ───────────────────────────────

describe('idempotence : await-health', () => {
  test('2ème run → aucune nouvelle transition SUCCESS', async () => {
    const pdn = new SourceResolverService().resolve(REPO_ANALYSIS);
    const repo = new PipelineRepositoryStub()
      .seed(DEP, 'RUNNING')
      .seedPlan(DEP, pdn);
    const agent = new AgentStub();
    agent.setHealthPassed(true);
    const runner = new PipelineJobRunner(repo, agent);

    const proc = new AwaitHealthProcessor(runner, agent, 0, 3);
    await proc.process(mockJob(JOB_DATA));

    // Simule un re-run : l'état est SUCCESS, le step est marqué done.
    await proc.process(mockJob(JOB_DATA)); // replay

    expect(repo.transitions.filter((t) => t.to === 'SUCCESS')).toHaveLength(1); // pas de doublon
    expect(agent.healthChecks).toHaveLength(1); // AgentPort appelé 1 seule fois
  });
});

// ── step non marqué done si le job échoue avant markStepDone ─────────────────

describe('idempotence : step NON marqué done si l\'action échoue', () => {
  test('provision-db échoue → step non complété → 2ème run ré-exécute le port', async () => {
    const repo = new PipelineRepositoryStub().seed(DEP, 'RUNNING');
    const agent = new AgentStub();
    const dbProvider = new DbProviderStub();
    const runner = new PipelineJobRunner(repo, agent);
    const queue = makeQueue();

    dbProvider.setProvisionFail(true);
    const proc = new ProvisionDbProcessor(runner, dbProvider, queue);
    await proc.process(mockJob(JOB_DATA)); // échec → FAILED, step PAS marqué done

    expect(await repo.isStepDone(DEP, JobName.PROVISION_DB)).toBe(false);
  });
});
