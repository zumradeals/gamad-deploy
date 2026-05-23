import { describe, test, expect } from 'vitest';
import type { RepoAnalysis } from '@gamad/contracts';
import { SourceResolverService } from '../source-resolver/source-resolver.service';
import { PdnValidationError } from '../pdn/pdn-validator';

const resolver = new SourceResolverService();

const BASE_ANALYSIS: RepoAnalysis = {
  repo_url: 'https://github.com/test/app',
  ref: { type: 'commit', value: 'abc1234' },
  commit_sha: 'abc1234567890abcdef',
  has_dockerfile: false,
  has_compose_file: true,
  has_gamad_json: false,
};

const VALID_CONTRACT = {
  contract_version: '1.0',
  name: 'test-app',
  artifact_type: 'docker-compose',
  source_ref: { type: 'commit', value: 'abc1234' },
  runtime: { ports: { http: 8080 } },
  env: [],
  health: { checks: [{ name: 'api', path: '/health', expected_status: 200, timeout_s: 30 }] },
  policies: { ban_latest: false, on_error_stop: true },
};

describe('SourceResolverService', () => {
  // ── Chemin A : avec contrat ─────────────────────────────────────────────

  test('resolve avec contrat valide → PDN via TemplateCompiler', () => {
    const analysis = { ...BASE_ANALYSIS, rawContract: JSON.stringify(VALID_CONTRACT) };
    const pdn = resolver.resolve(analysis);
    expect(pdn.pdn_version).toBe('1.0');
    expect(pdn.artifact.kind).toBe('docker-compose');
    expect(pdn.health_checks).toHaveLength(1);
    expect(pdn.health_checks[0]!.url).toBe('http://localhost:8080/health');
    expect(pdn.source.ref).toEqual({ type: 'commit', value: 'abc1234' });
  });

  test('resolve : URL du health check = protocol + host + port + path (C-01 vs C-02)', () => {
    const analysis = { ...BASE_ANALYSIS, rawContract: JSON.stringify(VALID_CONTRACT) };
    const pdn = resolver.resolve(analysis);
    expect(pdn.health_checks[0]!.url).toMatch(/^http:\/\/localhost:\d+\//);
  });

  test('resolve : ref de la RepoAnalysis prime sur source_ref du contrat', () => {
    const contract = { ...VALID_CONTRACT, source_ref: { type: 'branch', value: 'main' } };
    const analysis = {
      ...BASE_ANALYSIS,
      ref: { type: 'commit' as const, value: 'resolved-sha' },
      rawContract: JSON.stringify(contract),
    };
    const pdn = resolver.resolve(analysis);
    expect(pdn.source.ref).toEqual({ type: 'commit', value: 'resolved-sha' });
  });

  test('rawContract JSON malformé → erreur JSON', () => {
    const analysis = { ...BASE_ANALYSIS, rawContract: '{ not valid json' };
    expect(() => resolver.resolve(analysis)).toThrow(/JSON/);
  });

  test('rawContract JSON valide mais structure invalide → erreur gamad.json', () => {
    const analysis = { ...BASE_ANALYSIS, rawContract: JSON.stringify({ contract_version: '99.0' }) };
    expect(() => resolver.resolve(analysis)).toThrow(/gamad.json invalide/);
  });

  test('contrat ban_latest=true + source_ref branch → PdnValidationError (INV-02 + C-01)', () => {
    const contract = {
      ...VALID_CONTRACT,
      source_ref: { type: 'branch', value: 'main' },
      policies: { ban_latest: true, on_error_stop: true },
    };
    // Pas de ref dans analysis → fallback sur source_ref branch
    const { ref: _ref, ...noRef } = BASE_ANALYSIS;
    const analysis = { ...noRef, rawContract: JSON.stringify(contract) };
    expect(() => resolver.resolve(analysis)).toThrow(PdnValidationError);
    expect(() => resolver.resolve(analysis)).toThrow(/ban_latest/);
  });

  test('contrat ban_latest=true + analysis.ref=tag → pass (ref figée)', () => {
    const contract = { ...VALID_CONTRACT, policies: { ban_latest: true, on_error_stop: true } };
    const analysis = {
      ...BASE_ANALYSIS,
      ref: { type: 'tag' as const, value: 'v2.0.0' },
      rawContract: JSON.stringify(contract),
    };
    expect(() => resolver.resolve(analysis)).not.toThrow();
  });

  // ── Chemin B : sans contrat (inférence) ─────────────────────────────────

  test('resolve sans contrat + has_compose_file → kind=docker-compose', () => {
    const pdn = resolver.resolve({ ...BASE_ANALYSIS, has_compose_file: true });
    expect(pdn.artifact.kind).toBe('docker-compose');
  });

  test('resolve sans contrat + detected_runtime=node → kind=node', () => {
    const analysis = { ...BASE_ANALYSIS, has_compose_file: false, detected_runtime: 'node' };
    const pdn = resolver.resolve(analysis);
    expect(pdn.artifact.kind).toBe('node');
  });

  test('resolve sans contrat + aucun indicateur → kind=static', () => {
    const analysis: RepoAnalysis = { has_dockerfile: false, has_compose_file: false, has_gamad_json: false };
    const pdn = resolver.resolve(analysis);
    expect(pdn.artifact.kind).toBe('static');
  });

  test('resolve inféré → toujours au moins 1 health check (INV-03)', () => {
    const analysis: RepoAnalysis = { has_dockerfile: false, has_compose_file: false, has_gamad_json: false };
    const pdn = resolver.resolve(analysis);
    expect(pdn.health_checks.length).toBeGreaterThanOrEqual(1);
  });

  test('resolve inféré → version PDN = 1.0', () => {
    const pdn = resolver.resolve(BASE_ANALYSIS);
    expect(pdn.pdn_version).toBe('1.0');
  });
});
