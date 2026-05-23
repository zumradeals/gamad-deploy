// Preuve INV-08 (on_error_stop) chemin d'échec partiel certbot :
//   - Containers démarrés (docker compose up OK)
//   - Certbot échoue → erreur propagée
//   - Rollback : containers stoppés, nginx restauré depuis S0
// Ce scénario est le plus dangereux : l'état S1 partiel doit être entièrement annulé.

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

const PDN_WITH_TLS: PlanDeDeploiementNormalise = {
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
  proxy: { domain: 'app.example.com', https: true, paths: {} },
  health_checks: [{ name: 'https', url: 'https://app.example.com/health', expected_status: 200, timeout_s: 5, attempts: 3, interval_s: 5 }],
  policies: { ban_latest: false, on_error_stop: true }, // INV-08 : rollback obligatoire
};

const REQUEST: AgentDispatchRequest = {
  deployment_id: 'dep-fail-00000000-0000-0000-000000000001',
  resolved_plan: { ...PDN_WITH_TLS, plan_hash: 'fail123' },
  callback_url: 'http://control-plane/callback',
};

describe('Échec partiel certbot → rollback complet (INV-08)', () => {
  test('certbot échoue → containers S1 stoppés + nginx restauré depuis S0', async () => {
    const git = new GitExecutorStub();
    const docker = new DockerExecutorStub();
    const nginx = new NginxExecutorStub();
    const certbot = new CertbotExecutorStub();
    certbot.setFail(true);
    const snapshot = new SnapshotStub();
    const callback = new CallbackStub();
    const logger = new DeploymentLoggerService(callback);

    const service = new DeploymentService(git, docker, nginx, certbot, snapshot, logger);

    // Le déploiement échoue (certbot), mais ne rejette pas silencieusement.
    await expect(service.deploy(REQUEST)).rejects.toThrow(/certbot/i);

    // Snapshot S0 capturé AVANT les actions destructives (ADR-0007).
    expect(snapshot.captureCount).toBe(1);

    // Containers S1 stoppés (rollback step 1).
    expect(docker.stoppedDeployments).toContain(REQUEST.deployment_id);

    // Nginx restauré depuis S0 (rollback step 2 — domaine présent).
    expect(nginx.restoredSnapshots).toContain(REQUEST.deployment_id);
  });

  test('certbot échoue sans on_error_stop=false → pas de rollback', async () => {
    const docker = new DockerExecutorStub();
    const nginx = new NginxExecutorStub();
    const certbot = new CertbotExecutorStub();
    certbot.setFail(true);
    const pdnNoStop: PlanDeDeploiementNormalise = { ...PDN_WITH_TLS, policies: { ...PDN_WITH_TLS.policies, on_error_stop: false } };
    const request: AgentDispatchRequest = { ...REQUEST, resolved_plan: { ...pdnNoStop, plan_hash: 'nonstop' } };
    const service = new DeploymentService(
      new GitExecutorStub(), docker, nginx, certbot,
      new SnapshotStub(), new DeploymentLoggerService(new CallbackStub()),
    );

    await expect(service.deploy(request)).rejects.toThrow(/certbot/i);

    expect(docker.stoppedDeployments).toHaveLength(0); // pas de rollback
    expect(nginx.restoredSnapshots).toHaveLength(0);   // pas de restore nginx
  });

  test('certbot échoue → erreur non silencieuse (rejetée, pas absorbée)', async () => {
    const certbot = new CertbotExecutorStub();
    certbot.setFail(true);
    const service = new DeploymentService(
      new GitExecutorStub(), new DockerExecutorStub(), new NginxExecutorStub(),
      certbot, new SnapshotStub(), new DeploymentLoggerService(new CallbackStub()),
    );

    await expect(service.deploy(REQUEST)).rejects.toThrow();
  });
});
