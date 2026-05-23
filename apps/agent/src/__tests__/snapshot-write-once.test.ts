// Preuve ADR-0007 : snapshot write-once par deploymentId.
// Un replay BullMQ du job dispatch-agent ne recapture PAS un nouveau snapshot.
// Risque sans cette protection : snapshot S1 (post-déploiement cassé) écrase S0 → rollback impossible.
//
// Test clé : simulateDirtyState() modélise le passage à S1 (containers démarrés, fichiers modifiés).
// Le stub produce un capturedAt "S1-..." si capture() est appelé APRÈS cet état.
// Le test prouve que le rejoué retourne le manifest S0 original — pas un S1 fraîchement capturé.

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

const DEP = 'dep-snap-00000000-0000-0000-000000000001';
const CALLBACK = 'http://control-plane/callback';

const REQUEST: AgentDispatchRequest = {
  deployment_id: DEP,
  resolved_plan: { ...PDN, plan_hash: 'abc123' },
  callback_url: CALLBACK,
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
  test('2ème deploy → captureCount reste à 1 (compteur)', async () => {
    const snapshot = new SnapshotStub();
    const service = makeService(snapshot);

    await service.deploy(REQUEST);  // 1er run : capture S0
    await service.deploy(REQUEST);  // replay : S0 déjà présent → no-op

    expect(snapshot.captureCount).toBe(1);
  });

  // ── Test critique : scénario de danger réel ────────────────────────────────────────────────────
  // 1er deploy : S0 capturé (état propre).
  // simulateDirtyState() : système passe à S1 (containers up, fichiers modifiés).
  //   → Si ensureSnapshot appelait capture() maintenant, il retournerait un manifest "S1-..." différent.
  // 2ème deploy (replay BullMQ) : manifest S0 toujours présent → retourne S0, jamais S1.
  // Preuve contenu : capturedAt du manifest rejoué commence par "S0-", pas "S1-".
  test('deploy après simulateDirtyState → manifest retourné est S0, jamais S1 (preuve contenu)', async () => {
    const snapshot = new SnapshotStub();
    const service = makeService(snapshot);

    // 1er deploy : capture S0.
    await service.deploy(REQUEST);
    const s0Manifest = await snapshot.getManifest(DEP);
    expect(s0Manifest.capturedAt).toMatch(/^S0-/); // S0 bien capturé

    // Simulation : état système passe à S1.
    // Un capture() maintenant retournerait "S1-..." — c'est le danger qu'on bloque.
    snapshot.simulateDirtyState(DEP);

    // 2ème deploy (replay) : le guard détecte exists()=true → retourne S0 sans recapturer.
    await service.deploy(REQUEST);
    const manifestAfterReplay = await snapshot.getManifest(DEP);

    // Preuve compteur : capture() n'a pas été rappelée.
    expect(snapshot.captureCount).toBe(1);

    // Preuve contenu : même manifest S0, pas un S1 fraîchement capturé.
    expect(manifestAfterReplay.capturedAt).toBe(s0Manifest.capturedAt);
    expect(manifestAfterReplay.capturedAt).toMatch(/^S0-/); // S0, jamais S1
  });

  test('ensureSnapshot appelé directement en double → captureCount reste à 1', async () => {
    const snapshot = new SnapshotStub();
    const service = makeService(snapshot);

    await service.ensureSnapshot(DEP, CALLBACK);
    await service.ensureSnapshot(DEP, CALLBACK); // replay

    expect(snapshot.captureCount).toBe(1);
  });

  test('deploymentIds différents → chacun capturé 1 fois', async () => {
    const snapshot = new SnapshotStub();
    const service = makeService(snapshot);

    await service.ensureSnapshot('dep-001', CALLBACK);
    await service.ensureSnapshot('dep-002', CALLBACK);
    await service.ensureSnapshot('dep-001', CALLBACK); // replay dep-001

    expect(snapshot.captureCount).toBe(2); // dep-001 + dep-002, pas dep-001 en double
  });
});
