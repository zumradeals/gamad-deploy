// Tests d'intégration P-05 — "ça marche"
// Couverture : 5 couches réelles (Delivery→Orchestration→Domain→Adapters→Persistence)
//              Redis + Postgres réels, AgentPort stubbé.
//
// Prérequis : DATABASE_URL, REDIS_HOST/REDIS_PORT dans l'environnement.
// Schéma : migrations appliquées avant (pnpm --filter @gamad/schema run db:migrate).
//
// 4 scénarios :
//   E2E-01 SUCCESS   — pipeline complet → SUCCESS notifié via DeploymentNotifierService
//   E2E-02 FAILURE   — dispatch fail + on_error_stop → FAILED + rollback
//   E2E-03 IDEMPOTENCE — BullMQ replay → exactement 1 transition PENDING→RUNNING
//   E2E-04 RACE-2    — deux transitionWithLog(RUNNING→FAILED) simultanés → 1 seule ligne

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Queue, Worker } from 'bullmq';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { RepoAnalysis, TenantContext } from '@gamad/contracts';
import {
  organizations,
  projects,
  servers,
  deployments,
  deploymentStateTransitions,
  deploymentLogs,
} from '@gamad/schema';
import {
  PIPELINE_QUEUE,
  JobName,
  DEFAULT_JOB_OPTIONS,
} from '../../orchestration/pipeline/pipeline.constants';
import type { PipelineJobData } from '../../orchestration/pipeline/pipeline.types';
import { PipelineJobRunner } from '../../orchestration/processors/pipeline-job-runner';
import { ResolveSourceProcessor } from '../../orchestration/processors/resolve-source.processor';
import { ProvisionDbProcessor } from '../../orchestration/processors/provision-db.processor';
import { MigrateDataProcessor } from '../../orchestration/processors/migrate-data.processor';
import { DispatchAgentProcessor } from '../../orchestration/processors/dispatch-agent.processor';
import { AwaitHealthProcessor } from '../../orchestration/processors/await-health.processor';
import { AgentStub } from '../../orchestration/stubs/agent.stub';
import { DbProviderStub } from '../../orchestration/stubs/db-provider.stub';
import { SourceResolverService } from '../../domain/index';
import { PipelineRepositoryAdapter } from '../../adapters/pipeline-repository.adapter';
import { DeploymentNotifierService } from '../../delivery/deployment-notifier.service';

const DB_URL = process.env['DATABASE_URL'] ?? 'postgresql://gamad:gamad@localhost:5432/gamad_test';
const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost';
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
const REDIS_CONN = { host: REDIS_HOST, port: REDIS_PORT };

const REPO_ANALYSIS: RepoAnalysis = {
  repo_url: 'https://github.com/test/app',
  ref: { type: 'commit', value: 'abc1234' },
  commit_sha: 'abc1234567890abcdef',
  has_dockerfile: false,
  has_compose_file: true,
  has_gamad_json: false,
};

// ── Infrastructure partagée ────────────────────────────────────────────────────

let pool: pg.Pool;
let db: NodePgDatabase;
let notifier: DeploymentNotifierService;
let orgId: string;
let projectId: string;
let serverId: string;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: DB_URL });
  db = drizzle(pool);
  notifier = new DeploymentNotifierService();
  await notifier.onModuleInit();

  // Fixtures minimales (sans plan_id, server_id — non requis pour P-05).
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Test P-05', slug: `test-p05-${Date.now()}` })
    .returning({ id: organizations.id });
  orgId = org!.id;

  const [srv] = await db
    .insert(servers)
    .values({ orgId, name: 'Test Server P-05', host: 'stub-host', agentToken: `stub-agt-${Date.now()}` })
    .returning({ id: servers.id });
  serverId = srv!.id;

  const [proj] = await db
    .insert(projects)
    .values({ orgId, serverId, name: 'App Test', repoUrl: 'https://github.com/test/app', repoBranch: 'main' })
    .returning({ id: projects.id });
  projectId = proj!.id;
}, 30_000);

afterAll(async () => {
  await notifier.onModuleDestroy();
  await pool.end();
}, 10_000);

// ── Helpers ────────────────────────────────────────────────────────────────────

async function createDeployment(status: 'pending' | 'running' = 'pending'): Promise<string> {
  const [dep] = await db
    .insert(deployments)
    .values({ projectId, triggerType: 'manual', status })
    .returning({ id: deployments.id });
  return dep!.id;
}

function makePipeline(agent: AgentStub, intervalMs = 0, maxAttempts = 3) {
  const repo = new PipelineRepositoryAdapter(db);
  const dbProvider = new DbProviderStub();
  const queue = new Queue(PIPELINE_QUEUE, { connection: REDIS_CONN });
  const runner = new PipelineJobRunner(repo, agent);
  const resolveSource = new ResolveSourceProcessor(runner, new SourceResolverService(), queue);
  const provisionDb = new ProvisionDbProcessor(runner, dbProvider, queue);
  const migrateData = new MigrateDataProcessor(runner, dbProvider, queue);
  const dispatchAgent = new DispatchAgentProcessor(runner, agent, queue);
  const awaitHealth = new AwaitHealthProcessor(runner, agent, intervalMs, maxAttempts);

  const worker = new Worker(
    PIPELINE_QUEUE,
    async (job) => {
      switch (job.name) {
        case JobName.RESOLVE_SOURCE: return resolveSource.process(job);
        case JobName.PROVISION_DB: return provisionDb.process(job);
        case JobName.MIGRATE_DATA: return migrateData.process(job);
        case JobName.DISPATCH_AGENT: return dispatchAgent.process(job);
        case JobName.AWAIT_HEALTH: return awaitHealth.process(job);
      }
    },
    { connection: REDIS_CONN, concurrency: 1 },
  );

  return { repo, queue, worker };
}

function tenantCtx(): TenantContext {
  return { org_id: orgId, user_id: '00000000-0000-0000-0000-000000000001' };
}

/** Attend une transition terminale via Postgres NOTIFY — timeout configurable. */
function waitForTerminalState(
  deploymentId: string,
  timeoutMs = 20_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout : aucune transition terminale pour ${deploymentId}`)),
      timeoutMs,
    );

    const unsubscribe = notifier.subscribe(deploymentId, (event) => {
      const terminal = ['SUCCESS', 'FAILED', 'ROLLED_BACK'];
      if (terminal.includes(event.toState)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(event.toState);
      }
    });
  });
}

// ── E2E-01 : SUCCESS 5 couches ─────────────────────────────────────────────────

describe('E2E-01 SUCCESS — 5 couches, Redis + Postgres réels, AgentPort stubbé', () => {
  test('pipeline complet → SUCCESS notifié via DeploymentNotifierService (source WebSocket)', async () => {
    const agent = new AgentStub();
    agent.setHealthPassed(true);

    const deploymentId = await createDeployment('pending');
    const { queue, worker } = makePipeline(agent);

    const terminalState = waitForTerminalState(deploymentId);

    const jobData: PipelineJobData = {
      deploymentId,
      orgId,
      userId: tenantCtx().user_id,
      serverId,
      repoAnalysis: REPO_ANALYSIS,
    };
    await queue.add(JobName.RESOLVE_SOURCE, jobData, DEFAULT_JOB_OPTIONS);

    const finalState = await terminalState;
    await worker.close();
    await queue.close();

    expect(finalState).toBe('SUCCESS');

    // Vérifie que les 5 couches ont tracé des logs (Persistence)
    const logs = await db
      .select()
      .from(deploymentLogs)
      .where(eq(deploymentLogs.deploymentId, deploymentId));
    expect(logs.length).toBeGreaterThan(0);

    // La transition finale est RUNNING → SUCCESS (INV-03)
    const transitions = await db
      .select()
      .from(deploymentStateTransitions)
      .where(eq(deploymentStateTransitions.deploymentId, deploymentId));
    const successTransition = transitions.find((t) => t.toState === 'success');
    expect(successTransition).toBeDefined();
    expect(successTransition!.fromState).toBe('running');
  }, 30_000);
});

// ── E2E-02 : FAILURE + rollback ────────────────────────────────────────────────

describe('E2E-02 FAILURE — dispatch fail + on_error_stop → FAILED + rollback', () => {
  test('agent dispatch échoue → FAILED + rollback appelé', async () => {
    const agent = new AgentStub();
    agent.setDispatchFail(true);

    const deploymentId = await createDeployment('pending');
    const { queue, worker } = makePipeline(agent);

    const terminalState = waitForTerminalState(deploymentId);

    const jobData: PipelineJobData = {
      deploymentId,
      orgId,
      userId: tenantCtx().user_id,
      serverId,
      repoAnalysis: REPO_ANALYSIS,
    };
    await queue.add(JobName.RESOLVE_SOURCE, jobData, DEFAULT_JOB_OPTIONS);

    const finalState = await terminalState;
    await worker.close();
    await queue.close();

    expect(finalState).toBe('FAILED');

    // on_error_stop doit avoir déclenché le rollback (INV-08)
    expect(agent.rollbacks.length).toBeGreaterThan(0);
    expect(agent.rollbacks[0]!.deploymentId).toBe(deploymentId);

    // La transition RUNNING → FAILED est en base
    const [transition] = await db
      .select()
      .from(deploymentStateTransitions)
      .where(
        and(
          eq(deploymentStateTransitions.deploymentId, deploymentId),
          eq(deploymentStateTransitions.toState, 'failed'),
        ),
      );
    expect(transition).toBeDefined();
  }, 30_000);
});

// ── E2E-03 : IDEMPOTENCE sous BullMQ réel ─────────────────────────────────────

describe('E2E-03 IDEMPOTENCE — BullMQ rejoue le job → 1 seule transition PENDING→RUNNING', () => {
  test('double enqueue resolve-source → exactement 1 transition PENDING→RUNNING', async () => {
    const agent = new AgentStub();
    agent.setHealthPassed(true);

    const deploymentId = await createDeployment('pending');
    const { queue, worker } = makePipeline(agent);

    const terminalState = waitForTerminalState(deploymentId);

    const jobData: PipelineJobData = {
      deploymentId,
      orgId,
      userId: tenantCtx().user_id,
      serverId,
      repoAnalysis: REPO_ANALYSIS,
    };
    // Double enqueue simulant un replay BullMQ
    await queue.add(JobName.RESOLVE_SOURCE, jobData, DEFAULT_JOB_OPTIONS);
    await queue.add(JobName.RESOLVE_SOURCE, jobData, DEFAULT_JOB_OPTIONS);

    await terminalState;
    await worker.close();
    await queue.close();

    // INV-07 : isStepDone bloque le 2e resolve-source → 1 seule transition RUNNING
    const runningTransitions = await db
      .select()
      .from(deploymentStateTransitions)
      .where(
        and(
          eq(deploymentStateTransitions.deploymentId, deploymentId),
          eq(deploymentStateTransitions.toState, 'running'),
        ),
      );
    expect(runningTransitions).toHaveLength(1);
  }, 30_000);
});

// ── E2E-04 : RACE 2 ───────────────────────────────────────────────────────────
//
// CE QUE CE TEST PROUVE : l'optimistic-lock de PipelineRepositoryAdapter en isolation.
// Appel direct à repo.transitionWithLog() → la StateMachineService n'est PAS appelée ici.
//
// CE QUE CE TEST NE PROUVE PAS : la chaîne complète StateMachine + optimistic-lock.
// DETTE P-06 : ajouter un test qui déclenche deux handleFailure() simultanés via
// PipelineJobRunner (pas via repo.transitionWithLog() directement), pour prouver que
// StateMachineService.transition() est appelée EN AMONT dans les deux paths concurrents
// ET que l'optimistic-lock reste la seule ligne dans deployment_state_transitions.
// Référence : ADR-0008 §"Gap de couverture de test — E2E-04".

describe('E2E-04 RACE-2 — deux transitions RUNNING→FAILED simultanées → 1 seule ligne en base', () => {
  test(
    'optimistic-lock (UPDATE WHERE status=from) : le second concurrent voit 0 rows affected → no-op',
    async () => {
      const deploymentId = await createDeployment('running');
      const repo = new PipelineRepositoryAdapter(db);
      const ctx = tenantCtx();

      // Deux appels simultanés à transitionWithLog(RUNNING → FAILED).
      // Le premier UPDATE WHERE status='running' → 1 row affectée.
      // Le second UPDATE WHERE status='running' → 0 rows (déjà 'failed') → no-op.
      await Promise.all([
        repo.transitionWithLog(
          deploymentId, 'RUNNING', 'FAILED',
          { step: 'concurrent-a', message: 'échec concurrent A' },
          ctx,
        ),
        repo.transitionWithLog(
          deploymentId, 'RUNNING', 'FAILED',
          { step: 'concurrent-b', message: 'échec concurrent B' },
          ctx,
        ),
      ]);

      // Exactement 1 ligne FAILED dans deployment_state_transitions (INV-04 + Race-2 proof).
      const failedTransitions = await db
        .select()
        .from(deploymentStateTransitions)
        .where(
          and(
            eq(deploymentStateTransitions.deploymentId, deploymentId),
            eq(deploymentStateTransitions.toState, 'failed'),
          ),
        );

      expect(failedTransitions).toHaveLength(1);

      // L'état final est bien FAILED (pas de double-write qui corrompt l'audit).
      const state = await repo.getDeploymentState(deploymentId, ctx);
      expect(state).toBe('FAILED');
    },
    15_000,
  );
});
