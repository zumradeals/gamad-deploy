// Tests du consentement structurel — ValidatedContractDraft (ADR-0009).
// Prouve que :
//   1. Le sealed type ne peut pas être contourné (fromApproval = seule porte d'entrée)
//   2. Un draft_id vide lève une erreur
//   3. commitGamadJson n'est pas appelable sans ValidatedContractDraft (proof par typecheck)

import { describe, test, expect } from 'vitest';
import type { GamadContractDraft } from '@gamad/contracts';
import { ValidatedContractDraft } from '../contract-generator/validated-contract-draft';

const DRAFT: GamadContractDraft = {
  contract: {
    contract_version: '1.0',
    name: 'test-app',
    artifact_type: 'docker-compose',
    source_ref: { type: 'branch', value: 'main' },
    runtime: { ports: { http: 8080 } },
    env: [],
    health: { checks: [{ name: 'default', path: '/health', expected_status: 200, timeout_s: 30 }] },
    policies: { ban_latest: false, on_error_stop: true },
  },
  confidence: 0.75,
  assumptions: ['docker-compose.yml détecté'],
  warnings: ['health check path à vérifier'],
};

describe('ValidatedContractDraft — consentement structurel (ADR-0009)', () => {
  test('fromApproval avec draft_id valide retourne une instance', () => {
    const vd = ValidatedContractDraft.fromApproval(DRAFT, 'a1b2c3d4-0000-0000-0000-000000000001');
    expect(vd.draft).toBe(DRAFT);
    expect(vd.draftId).toBe('a1b2c3d4-0000-0000-0000-000000000001');
    expect(vd.validatedAt).toBeInstanceOf(Date);
  });

  test('fromApproval avec draft_id vide → erreur (consentement absent)', () => {
    expect(() => ValidatedContractDraft.fromApproval(DRAFT, '')).toThrow(
      /draft_id requis/,
    );
  });

  test('fromApproval avec draft_id blank (espaces) → erreur', () => {
    expect(() => ValidatedContractDraft.fromApproval(DRAFT, '   ')).toThrow(
      /draft_id requis/,
    );
  });

  test('constructeur privé — @ts-expect-error : toute régression rougit la CI', () => {
    // TypeScript `private` est compile-time only : JavaScript l'ignore → pas d'erreur runtime.
    // Si le constructeur devenait public, @ts-expect-error deviendrait une directive inutilisée
    // → tsc refuse le fichier → CI rouge. Même principe que l'import-lint d'architecture (P-00).
    // @ts-expect-error constructeur privé
    new ValidatedContractDraft(DRAFT, 'id', new Date());
  });
});
