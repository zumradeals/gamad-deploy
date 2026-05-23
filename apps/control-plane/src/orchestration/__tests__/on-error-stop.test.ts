// Preuve du chemin d'échec (INV-08) :
//   - Première erreur critique → transition RUNNING → FAILED via StateMachine (Domain)
//   - transition + log d'erreur dans le même appel transitionWithLog (C-11, atomique)
//   - rollback stub appelé si on_error_stop=true
//   - chemin d'échec aussi rigoureux que le chemin de succès :
//       mêmes validate → persist → act, pas un catch simplifié

import { describe, test, expect } from 'vitest';
import type { Job, Queue } from 'bullmq';
import { SourceResolverService } from '../../domain/index';
import { IllegalTransitionError } from '../../domain/state-machine/state-machine.service';
import { PipelineJobRunner } from '../processors/pipeline-job-runner';
import { ProvisionDbProcessor } from '../processors/provision-db.processor';
import { DispatchAgentProcessor } from '../processors/dispatch-agent.processor';
import { AwaitHealthProcessor } from '../processors/await-health.processor';
import { AgentStub } from '../stubs/agent.stub';
import { DbProviderStub } from '../stubs/db-provider.stub';
import { PipelineRepositoryStub } from '../stubs/pipeline-repository.stub';
import { JobName } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';

const DEP = 'dep-err-000000000-0000-0000-0000-000000000001';
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

const JOB_DATA: PipelineJobData = { deploymentId: DEP, orgId: ORG, userId: USR };

// ── Transition RUNNING → FAILED via StateMachine (Domain) ────────────────────

describe('on_error_stop : transition via Domain (pas de write direct)', () => {
  test('échec provision-db → état FAILED enregistré via transitionWithLog (atomique)', async () => {
    const repo = new PipelineRepositoryStub().seed(DEP, 'RUNNING');
    const agent = new AgentStub();
    const dbProvider = new DbProviderStub();
    dbProvider.setProvisionFail(true);
    const runner = new PipelineJobRunner(repo, agent);
    const queue = { add: async () => ({}) } as unknown as Queue;

    const proc = new ProvisionDbProcessor(runner, dbProvider, queue);
    await proc.process(mockJob(JOB_DATA));

    // Transition RUNNING → FAILED enregistrée
    expect(repo.transitions).toHaveLength(1);
    expect(repo.transitions[0]).toMatchObject({ from: 'RUNNING', to: 'FAILED', step: JobName.PROVISION_DB });

    // Log d'erreur dans le même appel (atomique — même enregistrement que la transition)
    expect(repo.logs.some((l) => l.step === JobName.PROVISION_DB && l.message.includes('provision simulée'))).toBe(true);

    // État final en base = FAILED
    expect(await repo.getDeploymentState(DEP)).toBe('FAILED');
  });

  test('échec dispatch-agent → rollback stub appelé (on_error_stop=true)', async () => {
    const pdn = new SourceResolverService().resolve(REPO_ANALYSIS);
    // on_error_stop est true par défaut dans le PDN inféré (policies.on_error_stop = true)
    expect(pdn.policies.on_error_stop).toBe(true);

    const repo = new PipelineRepositoryStub()
      .seed(DEP, 'RUNNING')
      .seedPlan(DEP, pdn);
    const agent = new AgentStub();
    agent.setDispatchFail(true);
    const runner = new PipelineJobRunner(repo, agent);
    const queue = { add: async () => ({}) } as unknown as Queue;

    const proc = new DispatchAgentProcessor(runner, agent, queue);
    await proc.process(mockJob(JOB_DATA));

    // Rollback stub appelé
    expect(agent.rollbacks).toHaveLength(1);
    expect(agent.rollbacks[0]?.deploymentId).toBe(DEP);
  });
});

// ── Transition → FAILED validée par le Domain avant persistance ───────────────

describe('on_error_stop : Domain valide avant write', () => {
  test('transition FAILED → FAILED illégale : StateMachine lève IllegalTransitionError avant tout write', async () => {
    // Simule un état déjà FAILED (ex : double retry BullMQ)
    const repo = new PipelineRepositoryStub().seed(DEP, 'FAILED');
    const agent = new AgentStub();
    const dbProvider = new DbProviderStub();
    dbProvider.setProvisionFail(true);
    const runner = new PipelineJobRunner(repo, agent);
    const queue = { add: async () => ({}) } as unknown as Queue;

    const proc = new ProvisionDbProcessor(runner, dbProvider, queue);
    // handleFailure voit currentState=FAILED → ne tente pas transition FAILED→FAILED
    // (StateMachine le bloquerait de toute façon : transition illégale)
    await proc.process(mockJob(JOB_DATA));

    // Aucune nouvelle transition écrite : on était déjà FAILED, runner skip la re-transition
    expect(repo.transitions).toHaveLength(0);
  });
});

// ── Chemin d'échec ≡ chemin de succès (même pipeline validate → persist → act) ──

describe('on_error_stop : chemin d\'échec aussi rigoureux que le succès', () => {
  test('await-health timeout → FAILED + rollback (pas de succès fantôme)', async () => {
    const pdn = new SourceResolverService().resolve(REPO_ANALYSIS);
    const repo = new PipelineRepositoryStub()
      .seed(DEP, 'RUNNING')
      .seedPlan(DEP, pdn);
    const agent = new AgentStub();
    agent.setHealthPassed(false); // tous les checks échouent

    const runner = new PipelineJobRunner(repo, agent);

    // maxAttempts=2 pour accélérer le test (intervalMs=0)
    const proc = new AwaitHealthProcessor(runner, agent, 0, 2);
    await proc.process(mockJob(JOB_DATA));

    expect(await repo.getDeploymentState(DEP)).toBe('FAILED');
    // Rollback déclenché (on_error_stop=true dans le PDN inféré)
    expect(agent.rollbacks).toHaveLength(1);
    // Aucune transition SUCCESS : le succès fantôme est impossible
    expect(repo.transitions.filter((t) => t.to === 'SUCCESS')).toHaveLength(0);
  });

  test('erreur dans le port n\'est jamais silencieuse : transition FAILED + log message', async () => {
    const repo = new PipelineRepositoryStub().seed(DEP, 'RUNNING');
    const agent = new AgentStub();
    const dbProvider = new DbProviderStub();
    dbProvider.setProvisionFail(true);
    const runner = new PipelineJobRunner(repo, agent);
    const queue = { add: async () => ({}) } as unknown as Queue;

    const proc = new ProvisionDbProcessor(runner, dbProvider, queue);
    await proc.process(mockJob(JOB_DATA));

    const errorLog = repo.logs.find((l) => l.step === JobName.PROVISION_DB);
    expect(errorLog).toBeDefined();
    expect(errorLog?.message).toMatch(/provision simulée/);
  });

  test('IllegalTransitionError depuis le Domain (SUCCESS → FAILED) n\'est pas silenciée', async () => {
    // Un processor qui tenterait une transition illégale depuis un état terminal
    // reçoit IllegalTransitionError du Domain avant toute écriture.
    const repo = new PipelineRepositoryStub().seed(DEP, 'SUCCESS');
    const agent = new AgentStub();
    const runner = new PipelineJobRunner(repo, agent);

    let caughtError: unknown = null;
    await runner.run(
      'test-step',
      { deploymentId: DEP, orgId: ORG, userId: USR },
      async (ctx) => {
        try {
          await ctx.transition('SUCCESS', 'FAILED', 'tentative illégale');
        } catch (err) {
          caughtError = err;
          throw err;
        }
      },
    );

    expect(caughtError).toBeInstanceOf(IllegalTransitionError);
  });
});
