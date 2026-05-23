// Preuve ADR-0007 : snapshot write-once par deploymentId.
// Un replay BullMQ du job dispatch-agent ne recapture PAS un nouveau snapshot.
// Risque sans cette protection : snapshot S1 (post-déploiement cassé) écrase S0 → rollback impossible.

import { describe, test, expect } from 'vitest';
import type { AgentDispatchRequest, PlanDeDeploiementNormalise } from '@gamad/contracts';
import { DeploymentService } from '../services/deployment.service';
import { DeploymentLoggerService } from '../services/deployment-logger.service';
import { GitExecutorStub } from '../stubs/git-executor.stub';
import { DockerExecutorStub } from '../stubs/docker-executor.stub';
import { NginxExecutorStub } from '../stubs/nginx-executor.stub';
import { CertbotExecutorStub } from '../stubs/certbot-executor.stub';
import { SnapshotStub } from '../stubs/snapshot.stub';
import { CallbackStub } from '../stubs/callback.stub';

const PDN: PlanDeDeploiementNormalise = {
  pdn_version: '1.0',
  source: {
    type: 'git',
    url: 'https://github.com/test/app',
    ref: { type: 'commit', value: 'abc1234' },
    fingerprint: { commit_sha: 'abc1234' },
  },
  artifact: { kind: 'docker-compose', compose_file: 'docker-compose.yml' },
  env_vars: [],
  runtime: { ports: { app: 3000 } },
  proxy: { https: false, paths: {} },
  health_checks: [{ name: 'http', url: 'http://localhost:3000/health', expected_status: 200, timeout_s: 5, attempts: 3, interval_s: 5 }],
  policies: { ban_latest: false, on_error_stop: false },
};

const REQUEST: AgentDispatchRequest = {
  deployment_id: 'dep-snap-00000000-0000-0000-000000000001',
  resolved_plan: { ...PDN, plan_hash: 'abc123' },
  callback_url: 'http://control-plane/callback',
};

function makeService(snapshot: SnapshotStub): DeploymentService {
  const callback = new CallbackStub();
  const logger = new DeploymentLoggerService(callback);
  return new DeploymentService(
    new GitExecutorStub(),
    new DockerExecutorStub(),
    new NginxExecutorStub(),
    new CertbotExecutorStub(),
    snapshot,
    logger,
  );
}

describe('Snapshot write-once (ADR-0007)', () => {
  test('2ème deploy → captureCount reste à 1 (pas de re-capture)', async () => {
    const snapshot = new SnapshotStub();
    const service = makeService(snapshot);

    await service.deploy(REQUEST);          // 1er run : capture S0
    await service.deploy(REQUEST);          // replay : S0 déjà présent → no-op

    expect(snapshot.captureCount).toBe(1); // protection ADR-0007
  });

  test('ensureSnapshot appelé directement en double → captureCount reste à 1', async () => {
    const snapshot = new SnapshotStub();
    const service = makeService(snapshot);

    await service.ensureSnapshot(REQUEST.deployment_id, REQUEST.callback_url);
    await service.ensureSnapshot(REQUEST.deployment_id, REQUEST.callback_url); // replay

    expect(snapshot.captureCount).toBe(1);
  });

  test('deploymentIds différents → chacun capturé 1 fois', async () => {
    const snapshot = new SnapshotStub();
    const service = makeService(snapshot);

    await service.ensureSnapshot('dep-001', REQUEST.callback_url);
    await service.ensureSnapshot('dep-002', REQUEST.callback_url);
    await service.ensureSnapshot('dep-001', REQUEST.callback_url); // replay dep-001

    expect(snapshot.captureCount).toBe(2); // dep-001 + dep-002, pas dep-001 en double
  });
});
