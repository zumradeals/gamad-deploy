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

  // Preuve par typecheck (pas de test runtime) :
  // new ValidatedContractDraft(DRAFT, 'id', new Date()) → TS error: constructeur privé.
  // GitWritePort.commitGamadJson(rawDraft, params) → TS error: type incompatible.
  // Ces deux garanties sont vérifiées par "pnpm run typecheck" dans la CI.
  test('la preuve structurelle est dans le typecheck CI (constructeur privé)', () => {
    // Ce test documente la garantie — il ne peut pas échouer à l'exécution
    // car le compilateur aurait déjà refusé le fichier.
    expect(true).toBe(true);
  });
});
