// C-13 — ContractGenerator (Normalizer)
// À partir de l'analyse d'un repo brut, produit un gamad.json candidat.
// Jamais d'écriture sans validation explicite de l'utilisateur (INV-02).
// Le draft expose toujours ses assumptions et confidence — pas de magie opaque.
// commitToRepo privilégie le mode pull_request (non destructif) par défaut.

import type { ContratRepo } from './repo-contract';
import type { RepoAnalysis } from './source-resolver';

export interface GamadContractDraft {
  contract: ContratRepo;
  /** 0..1 — certitude de l'inférence. */
  confidence: number;
  /** Hypothèses faites lors de l'inférence. */
  assumptions: string[];
  /** Ce que l'utilisateur doit vérifier avant validation. */
  warnings: string[];
}

export interface CommitContractParams {
  project_id: string;  // UUID v4
  contract: ContratRepo;
  mode: 'pull_request' | 'direct_commit';
  /** Jamais loggé (CLAUDE.md §8). */
  git_token: string;
}

export interface CommitResult {
  mode: string;
  ref_url: string;
}

export interface ContractGenerator {
  generate(analysis: RepoAnalysis): GamadContractDraft;
  commitToRepo(params: CommitContractParams): Promise<CommitResult>;
}
