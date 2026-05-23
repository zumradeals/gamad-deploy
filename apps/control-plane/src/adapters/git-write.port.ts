// Port pour l'écriture Git (C-13, INV-09).
// La signature exige ValidatedContractDraft — jamais un draft brut.
// git_token : jamais loggé, jamais persisté (CLAUDE.md §8).

import type { ValidatedContractDraft } from '../domain/contract-generator/validated-contract-draft';

export interface GitWriteParams {
  owner: string;
  repoName: string;
  /** Jamais loggé (CLAUDE.md §8). */
  gitToken: string;
  mode: 'pr' | 'direct';
  /** Branche cible (direct) ou base de la PR. */
  targetBranch: string;
  /** Branche par défaut du repo — pour la vérification confirm_default_branch. */
  defaultBranch: string;
  overwriteExisting: boolean;
  /** Requis si mode='direct' ET targetBranch === defaultBranch (ADR-0009). */
  confirmDefaultBranch: boolean;
}

export interface GitWriteResult {
  mode: 'pr' | 'direct';
  /** URL de la PR créée ou du commit écrit. */
  url: string;
}

export abstract class GitWritePort {
  abstract commitGamadJson(
    validatedDraft: ValidatedContractDraft,
    params: GitWriteParams,
  ): Promise<GitWriteResult>;
}
