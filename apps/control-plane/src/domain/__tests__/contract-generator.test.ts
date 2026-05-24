import { describe, test, expect } from 'vitest';
import type { RepoAnalysis } from '@gamad/contracts';
import { ContractGeneratorService } from '../contract-generator/contract-generator.service';

const generator = new ContractGeneratorService();

const BASE_ANALYSIS: RepoAnalysis = {
  repo_url: 'https://github.com/test/my-app',
  ref: { type: 'commit', value: 'abc1234' },
  commit_sha: 'abc1234567890abcdef',
  has_dockerfile: false,
  has_compose_file: false,
  has_gamad_json: false,
};

describe('ContractGeneratorService', () => {
  // ── Inférence artifact_type ─────────────────────────────────────────────

  test('has_compose_file → artifact_type=docker-compose, confidence=0.90', () => {
    const draft = generator.generate({ ...BASE_ANALYSIS, has_compose_file: true });
    expect(draft.contract.artifact_type).toBe('docker-compose');
    expect(draft.confidence).toBe(0.90);
  });

  test('detected_runtime=node → artifact_type=node, confidence=0.55', () => {
    const draft = generator.generate({ ...BASE_ANALYSIS, detected_runtime: 'node' });
    expect(draft.contract.artifact_type).toBe('node');
    expect(draft.confidence).toBe(0.55);
  });

  test('detected_framework=express → artifact_type=node, confidence=0.75', () => {
    const draft = generator.generate({ ...BASE_ANALYSIS, detected_framework: 'express' });
    expect(draft.contract.artifact_type).toBe('node');
    expect(draft.confidence).toBe(0.75);
  });

  test('detected_framework=inconnu (rails) → artifact_type=static, confidence=0.20', () => {
    const draft = generator.generate({ ...BASE_ANALYSIS, detected_framework: 'rails' });
    expect(draft.contract.artifact_type).toBe('static');
    expect(draft.confidence).toBe(0.20);
  });

  test('aucun indicateur → artifact_type=static, confidence=0.20', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    expect(draft.contract.artifact_type).toBe('static');
    expect(draft.confidence).toBe(0.20);
  });

  // ── Health checks ────────────────────────────────────────────────────────

  test('toujours au moins 1 health check (INV-03)', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    expect(draft.contract.health.checks.length).toBeGreaterThanOrEqual(1);
  });

  test('health check par défaut → path=/health, expected_status=200', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    const check = draft.contract.health.checks[0]!;
    expect(check.path).toBe('/health');
    expect(check.expected_status).toBe(200);
  });

  // ── Métadonnées du contrat ───────────────────────────────────────────────

  test('contract_version toujours 1.0', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    expect(draft.contract.contract_version).toBe('1.0');
  });

  test('name inféré depuis repo_url', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    expect(draft.contract.name).toBe('my-app');
  });

  test('name = app si repo_url absent', () => {
    const { repo_url: _url, ...noUrl } = BASE_ANALYSIS;
    const draft = generator.generate(noUrl);
    expect(draft.contract.name).toBe('app');
  });

  test('source_ref = analysis.ref si présent', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    expect(draft.contract.source_ref).toEqual({ type: 'commit', value: 'abc1234' });
  });

  test('source_ref = branch:main par défaut si analysis.ref absent', () => {
    const { ref: _ref, ...noRef } = BASE_ANALYSIS;
    const draft = generator.generate(noRef);
    expect(draft.contract.source_ref).toEqual({ type: 'branch', value: 'main' });
  });

  // ── Assumptions & warnings ───────────────────────────────────────────────

  test('assumptions non vide pour tout appel', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    expect(draft.assumptions.length).toBeGreaterThanOrEqual(1);
  });

  test('warnings non vide (health check path toujours signalé)', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    expect(draft.warnings.length).toBeGreaterThanOrEqual(1);
    expect(draft.warnings.some((w) => w.toLowerCase().includes('health'))).toBe(true);
  });

  test('confidence faible → warning sur inférence insuffisante', () => {
    const draft = generator.generate(BASE_ANALYSIS);
    expect(draft.warnings.some((w) => w.toLowerCase().includes('inférence'))).toBe(true);
  });

  // ── commitToRepo — I/O non implémenté ───────────────────────────────────

  test('commitToRepo rejette avec erreur explicite (I/O non implémenté ici)', async () => {
    await expect(
      generator.commitToRepo({
        project_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        contract: {} as never,
        mode: 'direct_commit',
        git_token: 'dummy',
      }),
    ).rejects.toThrow(/commitToRepo/);
  });
});
