// Preuve INV-10 structurel : PDN avec ref malveillant → PdnSecurityValidatorError levée.
// Test d'isolation bout en bout : GitExecutorStub est câblé dans DeploymentService ;
// gitSpy.clones === 0 parce que le service a refusé AVANT le clone, pas parce que le spy est inerte.
// Le PDN ne peut pas exprimer une commande shell (pas de champ executeCommand).

import { describe, test, expect } from 'vitest';
import type { AgentDispatchRequest, PlanDeDeploiementNormalise } from '@gamad/contracts';
import { PdnSecurityValidatorService, PdnSecurityValidatorError } from '../services/pdn-security-validator.service';
import { DeploymentService } from '../services/deployment.service';
import { DeploymentLoggerService } from '../services/deployment-logger.service';
import { GitExecutorStub } from '../stubs/git-executor.stub';
import { DockerExecutorStub } from '../stubs/docker-executor.stub';
import { NginxExecutorStub } from '../stubs/nginx-executor.stub';
import { CertbotExecutorStub } from '../stubs/certbot-executor.stub';
import { SnapshotStub } from '../stubs/snapshot.stub';
import { CallbackStub } from '../stubs/callback.stub';

const VALID_PDN: PlanDeDeploiementNormalise = {
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
  policies: { ban_latest: false, on_error_stop: true },
};

function makeServiceWithGitSpy(gitSpy: GitExecutorStub): DeploymentService {
  return new DeploymentService(
    gitSpy,
    new DockerExecutorStub(),
    new NginxExecutorStub(),
    new CertbotExecutorStub(),
    new SnapshotStub(),
    new DeploymentLoggerService(new CallbackStub()),
  );
}

describe('PdnSecurityValidatorService (INV-10)', () => {
  test('PDN sain → pass, aucune exception levée', () => {
    const validator = new PdnSecurityValidatorService();
    expect(() => validator.validate(VALID_PDN)).not.toThrow();
  });

  test('ref.value avec injection shell → PdnSecurityValidatorError', () => {
    const validator = new PdnSecurityValidatorService();
    const malicious: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      source: { ...VALID_PDN.source, ref: { type: 'branch', value: 'main; rm -rf /' } },
    };
    expect(() => validator.validate(malicious)).toThrow(PdnSecurityValidatorError);
  });

  test('ref.value avec injection via backtick → PdnSecurityValidatorError', () => {
    const validator = new PdnSecurityValidatorService();
    const malicious: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      source: { ...VALID_PDN.source, ref: { type: 'tag', value: '`cat /etc/passwd`' } },
    };
    expect(() => validator.validate(malicious)).toThrow(PdnSecurityValidatorError);
  });

  test('source.url avec protocole file:// interdit → PdnSecurityValidatorError', () => {
    const validator = new PdnSecurityValidatorService();
    const malicious: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      source: { ...VALID_PDN.source, url: 'file:///etc/passwd' },
    };
    expect(() => validator.validate(malicious)).toThrow(PdnSecurityValidatorError);
  });

  test('artifact.compose_file avec path traversal → PdnSecurityValidatorError', () => {
    const validator = new PdnSecurityValidatorService();
    const malicious: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      artifact: { ...VALID_PDN.artifact, compose_file: '../../etc/passwd' },
    };
    expect(() => validator.validate(malicious)).toThrow(PdnSecurityValidatorError);
  });

  test('artifact.compose_file chemin absolu → PdnSecurityValidatorError', () => {
    const validator = new PdnSecurityValidatorService();
    const malicious: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      artifact: { ...VALID_PDN.artifact, compose_file: '/etc/docker/compose.yml' },
    };
    expect(() => validator.validate(malicious)).toThrow(PdnSecurityValidatorError);
  });

  test('proxy.domain avec injection → PdnSecurityValidatorError', () => {
    const validator = new PdnSecurityValidatorService();
    const malicious: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      proxy: { ...VALID_PDN.proxy, domain: 'app.example.com; curl attacker.io' },
    };
    expect(() => validator.validate(malicious)).toThrow(PdnSecurityValidatorError);
  });

  test('proxy.domain valide → pass', () => {
    const validator = new PdnSecurityValidatorService();
    const withDomain: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      proxy: { ...VALID_PDN.proxy, domain: 'app.example.com' },
    };
    expect(() => validator.validate(withDomain)).not.toThrow();
  });
});

// ── Isolation bout en bout (test critique INV-10) ───────────────────────────────────────────────
// GitExecutorStub EST câblé dans DeploymentService.
// gitSpy.clones === 0 PARCE QUE deploy() a refusé avant d'atteindre le clone — pas parce que le spy est inerte.

describe('INV-10 isolation bout en bout : deploy() refuse AVANT git clone', () => {
  test('ref malveillante → PdnSecurityValidatorError, GitExecutorPort.clone jamais appelé', async () => {
    const gitSpy = new GitExecutorStub();
    const service = makeServiceWithGitSpy(gitSpy);

    const maliciousPdn: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      source: { ...VALID_PDN.source, ref: { type: 'branch', value: 'main; rm -rf /' } },
    };
    const request: AgentDispatchRequest = {
      deployment_id: 'dep-inv10-isolation-001',
      resolved_plan: { ...maliciousPdn, plan_hash: 'badref' },
      callback_url: 'http://control-plane/callback',
    };

    // deploy() lève avant tout appel de port.
    await expect(service.deploy(request)).rejects.toThrow(PdnSecurityValidatorError);

    // Preuve d'isolation : gitSpy est câblé, mais clone() n'a jamais été atteint.
    // Le validateur bloque la chaîne AVANT le premier appel de port.
    expect(gitSpy.clones).toHaveLength(0);
  });

  test('source.url malveillante → PdnSecurityValidatorError, GitExecutorPort.clone jamais appelé', async () => {
    const gitSpy = new GitExecutorStub();
    const service = makeServiceWithGitSpy(gitSpy);

    const maliciousPdn: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      source: { ...VALID_PDN.source, url: 'file:///etc/passwd' },
    };
    const request: AgentDispatchRequest = {
      deployment_id: 'dep-inv10-isolation-002',
      resolved_plan: { ...maliciousPdn, plan_hash: 'badurl' },
      callback_url: 'http://control-plane/callback',
    };

    await expect(service.deploy(request)).rejects.toThrow(PdnSecurityValidatorError);
    expect(gitSpy.clones).toHaveLength(0);
  });

  test('PDN sain → gitSpy.clone appelé 1 fois (prouve que le spy fonctionne)', async () => {
    const gitSpy = new GitExecutorStub();
    const service = makeServiceWithGitSpy(gitSpy);

    const request: AgentDispatchRequest = {
      deployment_id: 'dep-inv10-valid-001',
      resolved_plan: { ...VALID_PDN, plan_hash: 'goodhash' },
      callback_url: 'http://control-plane/callback',
    };

    await service.deploy(request);

    // Le PDN sain passe le validator → clone est bien appelé.
    // Ce test prouve que le spy est vivant et que les assertions ci-dessus ne trivient pas.
    expect(gitSpy.clones).toHaveLength(1);
    expect(gitSpy.clones[0]?.deploymentId).toBe('dep-inv10-valid-001');
  });
});
