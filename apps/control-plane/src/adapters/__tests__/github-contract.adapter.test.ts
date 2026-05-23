// Tests de GithubContractAdapter (P-06).
// Prouve les quatre garanties de P-06 :
//   1. Branche orpheline nettoyée si le commit échoue (transaction compensatoire ADR-0009)
//   2. gamad.json existant bloqué sans overwrite_existing (GAMAD_JSON_EXISTS)
//   3. Commit direct sur branche non-défaut → pas de confirm_default_branch requis
//   4. Commit direct sur branche par défaut sans confirm_default_branch → refus

import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { GamadContractDraft } from '@gamad/contracts';
import { GithubContractAdapter } from '../github-contract.adapter';
import { ValidatedContractDraft } from '../../domain/contract-generator/validated-contract-draft';
import type { GitWriteParams } from '../git-write.port';

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

const DRAFT_ID = 'a1b2c3d4-1111-2222-3333-444444444444';
const VALIDATED = ValidatedContractDraft.fromApproval(DRAFT, DRAFT_ID);

const BASE_PARAMS: GitWriteParams = {
  owner: 'test-org',
  repoName: 'test-app',
  gitToken: 'ghp_test_token',
  mode: 'pr',
  targetBranch: 'main',
  defaultBranch: 'main',
  overwriteExisting: false,
  confirmDefaultBranch: false,
};

// ── Helpers fetch mock ────────────────────────────────────────────────────────

type FetchMock = ReturnType<typeof vi.fn>;
let mockFetch: FetchMock;

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function errorResponse(status: number, message = 'error') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
    text: () => Promise.resolve(message),
  });
}

function successPrFlow(mockFetch: FetchMock): void {
  mockFetch
    // 1. GET base branch SHA
    .mockResolvedValueOnce(jsonResponse({ object: { sha: 'base-sha-abc' } }))
    // 2. POST create branch
    .mockResolvedValueOnce(jsonResponse({}))
    // 3. GET gamad.json → 404 (absent)
    .mockResolvedValueOnce(jsonResponse({}, 404))
    // 4. PUT gamad.json
    .mockResolvedValueOnce(jsonResponse({}))
    // 5. POST create PR
    .mockResolvedValueOnce(jsonResponse({ html_url: 'https://github.com/test-org/test-app/pull/1' }));
}

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GithubContractAdapter — mode PR', () => {
  test('flux nominal → retourne URL de la PR', async () => {
    successPrFlow(mockFetch);
    const adapter = new GithubContractAdapter();
    const result = await adapter.commitGamadJson(VALIDATED, BASE_PARAMS);
    expect(result.mode).toBe('pr');
    expect(result.url).toBe('https://github.com/test-org/test-app/pull/1');
  });

  test('T1 — branche orpheline nettoyée si le commit (étape 4) échoue', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ object: { sha: 'base-sha-abc' } })) // GET SHA
      .mockResolvedValueOnce(jsonResponse({}))                                   // POST branch
      .mockResolvedValueOnce(jsonResponse({}, 404))                              // GET gamad.json → absent
      .mockResolvedValueOnce(errorResponse(422, 'Unprocessable'))                // PUT fails
      .mockResolvedValueOnce(jsonResponse({}));                                  // DELETE branch (compensation)

    const adapter = new GithubContractAdapter();
    await expect(adapter.commitGamadJson(VALIDATED, BASE_PARAMS)).rejects.toThrow(/422/);

    // Le DELETE de compensation doit avoir été appelé.
    const deleteCalls = (mockFetch as FetchMock).mock.calls.filter(
      ([_url, opts]) => (opts as RequestInit)?.method === 'DELETE',
    );
    expect(deleteCalls).toHaveLength(1);
    // Vérifie que la branche supprimée est bien gamad/contract-{draftId}.
    expect(deleteCalls[0]![0] as string).toContain(`gamad/contract-${DRAFT_ID}`);
  });

  test('T2 — gamad.json existant sans overwrite_existing → GAMAD_JSON_EXISTS', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ object: { sha: 'base-sha' } })) // GET SHA
      .mockResolvedValueOnce(jsonResponse({}))                               // POST branch
      .mockResolvedValueOnce(jsonResponse({ sha: 'file-sha' }))             // GET gamad.json → EXISTE
      .mockResolvedValueOnce(jsonResponse({}));                              // DELETE compensation

    const adapter = new GithubContractAdapter();
    await expect(
      adapter.commitGamadJson(VALIDATED, { ...BASE_PARAMS, overwriteExisting: false }),
    ).rejects.toThrow(/GAMAD_JSON_EXISTS/);
  });

  test('gamad.json existant + overwrite_existing: true → inclut le sha dans le PUT', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ object: { sha: 'base-sha' } }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ sha: 'existing-file-sha' })) // gamad.json existe
      .mockResolvedValueOnce(jsonResponse({}))                           // PUT avec sha
      .mockResolvedValueOnce(jsonResponse({ html_url: 'https://github.com/test-org/test-app/pull/2' }));

    const adapter = new GithubContractAdapter();
    const result = await adapter.commitGamadJson(VALIDATED, { ...BASE_PARAMS, overwriteExisting: true });
    expect(result.mode).toBe('pr');

    // Vérifie que le PUT contient le sha existant (anti-race GitHub natif).
    const putCall = (mockFetch as FetchMock).mock.calls.find(
      ([_url, opts]) => (opts as RequestInit)?.method === 'PUT',
    );
    const putBody = JSON.parse((putCall![1] as RequestInit).body as string) as { sha?: string };
    expect(putBody.sha).toBe('existing-file-sha');
  });
});

describe('GithubContractAdapter — mode direct', () => {
  const directParams: GitWriteParams = {
    ...BASE_PARAMS,
    mode: 'direct',
  };

  test('T3 — branche non-défaut sans confirm_default_branch → succès', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 404))                              // GET gamad.json → absent
      .mockResolvedValueOnce(jsonResponse({ commit: { html_url: 'https://github.com/test-org/test-app/commit/abc' } }));

    const adapter = new GithubContractAdapter();
    const result = await adapter.commitGamadJson(VALIDATED, {
      ...directParams,
      targetBranch: 'feature/add-contract', // != defaultBranch='main'
      confirmDefaultBranch: false,           // non requis ici
    });
    expect(result.mode).toBe('direct');
    expect(result.url).toContain('commit');
  });

  test('T4 — branche par défaut sans confirm_default_branch → refus immédiat (aucun appel réseau)', async () => {
    const adapter = new GithubContractAdapter();
    await expect(
      adapter.commitGamadJson(VALIDATED, {
        ...directParams,
        targetBranch: 'main',    // == defaultBranch
        confirmDefaultBranch: false,
      }),
    ).rejects.toThrow(/confirm_default_branch/);

    // Aucun appel réseau émis (refus avant toute I/O).
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('branche par défaut avec confirm_default_branch: true → succès', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ commit: { html_url: 'https://github.com/test-org/test-app/commit/xyz' } }));

    const adapter = new GithubContractAdapter();
    const result = await adapter.commitGamadJson(VALIDATED, {
      ...directParams,
      targetBranch: 'main',
      confirmDefaultBranch: true,
    });
    expect(result.mode).toBe('direct');
  });
});
