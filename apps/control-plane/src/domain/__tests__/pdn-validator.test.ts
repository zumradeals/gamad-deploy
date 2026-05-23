import { describe, test, expect } from 'vitest';
import type { HealthCheck, PlanDeDeploiementNormalise } from '@gamad/contracts';
import { PdnValidationError, validatePdn } from '../pdn/pdn-validator';

const BASE_PDN: PlanDeDeploiementNormalise = {
  pdn_version: '1.0',
  source: {
    type: 'git',
    url: 'https://github.com/test/app',
    ref: { type: 'commit', value: 'abc123def456' },
    fingerprint: {},
  },
  artifact: { kind: 'node' },
  env_vars: [],
  runtime: { ports: { http: 3000 } },
  proxy: { paths: { '/': { target: 'http://localhost:3000' } }, https: true },
  health_checks: [
    { name: 'api', url: 'http://localhost:3000/health', expected_status: 200, timeout_s: 30, attempts: 3, interval_s: 10 },
  ],
  policies: { ban_latest: false, on_error_stop: true },
};

describe('PdnValidator', () => {
  test('PDN valide → pass', () => {
    expect(() => validatePdn(BASE_PDN)).not.toThrow();
  });

  test('version inconnue → PdnValidationError', () => {
    const pdn = { ...BASE_PDN, pdn_version: '2.0' as never };
    expect(() => validatePdn(pdn)).toThrow(PdnValidationError);
    expect(() => validatePdn(pdn)).toThrow(/version inconnue/);
  });

  test('zéro health check → PdnValidationError (garde runtime, désérialisation JSON sans typage)', () => {
    const pdn = { ...BASE_PDN, health_checks: [] as unknown as [HealthCheck, ...HealthCheck[]] };
    expect(() => validatePdn(pdn)).toThrow(PdnValidationError);
    expect(() => validatePdn(pdn)).toThrow(/health check/);
  });

  test('ban_latest=true + ref.type=branch → PdnValidationError', () => {
    const pdn = {
      ...BASE_PDN,
      source: { ...BASE_PDN.source, ref: { type: 'branch' as const, value: 'main' } },
      policies: { ban_latest: true, on_error_stop: true },
    };
    expect(() => validatePdn(pdn)).toThrow(PdnValidationError);
    expect(() => validatePdn(pdn)).toThrow(/ban_latest/);
  });

  test('ban_latest=true + ref.type=tag → pass (ref figée)', () => {
    const pdn = {
      ...BASE_PDN,
      source: { ...BASE_PDN.source, ref: { type: 'tag' as const, value: 'v1.0.0' } },
      policies: { ban_latest: true, on_error_stop: true },
    };
    expect(() => validatePdn(pdn)).not.toThrow();
  });

  test('ban_latest=true + ref.type=commit → pass (ref figée)', () => {
    const pdn = {
      ...BASE_PDN,
      source: { ...BASE_PDN.source, ref: { type: 'commit' as const, value: 'abc123' } },
      policies: { ban_latest: true, on_error_stop: true },
    };
    expect(() => validatePdn(pdn)).not.toThrow();
  });

  test('env_var name en lowercase → PdnValidationError', () => {
    const pdn = {
      ...BASE_PDN,
      env_vars: [{ name: 'bad_name', required: false, secret: false }],
    };
    expect(() => validatePdn(pdn)).toThrow(PdnValidationError);
    expect(() => validatePdn(pdn)).toThrow(/variable d'environnement/);
  });

  test('env_var name UPPER_SNAKE_CASE → pass', () => {
    const pdn = {
      ...BASE_PDN,
      env_vars: [{ name: 'DATABASE_URL', required: true, secret: true }],
    };
    expect(() => validatePdn(pdn)).not.toThrow();
  });
});
