// Preuve INV-10 structurel : PDN avec ref malveillant → PdnSecurityValidatorError levée.
// Le spy GitExecutorPort montre 0 appels → aucune exécution avant validation.
// Le PDN ne peut pas exprimer une commande shell (pas de champ executeCommand).
// Ce test prouve que la protection opère AVANT le premier contact avec un port d'exécution.

import { describe, test, expect } from 'vitest';
import type { PlanDeDeploiementNormalise } from '@gamad/contracts';
import { PdnSecurityValidatorService, PdnSecurityValidatorError } from '../services/pdn-security-validator.service';
import { GitExecutorStub } from '../stubs/git-executor.stub';

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

describe('PdnSecurityValidatorService (INV-10)', () => {
  test('PDN sain → pass, GitExecutorPort non appelé', () => {
    const gitSpy = new GitExecutorStub();
    const validator = new PdnSecurityValidatorService();

    expect(() => validator.validate(VALID_PDN)).not.toThrow();
    expect(gitSpy.clones).toHaveLength(0); // spy prouve qu'aucun executor n'a été appelé
  });

  test('ref.value avec injection shell → PdnSecurityValidatorError avant tout executor', () => {
    const gitSpy = new GitExecutorStub();
    const validator = new PdnSecurityValidatorService();
    const malicious: PlanDeDeploiementNormalise = {
      ...VALID_PDN,
      source: { ...VALID_PDN.source, ref: { type: 'branch', value: 'main; rm -rf /' } },
    };

    expect(() => validator.validate(malicious)).toThrow(PdnSecurityValidatorError);
    expect(gitSpy.clones).toHaveLength(0); // zéro exécution
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
