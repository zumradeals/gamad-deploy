// C-03 — SourceResolver : Compiler + Adapter
// Transformer une source en PDN. Deux chemins, une seule sortie (INV-01).
// Règle figée : gamad.json présent → TemplateCompiler ; sinon → GitAdapter.
// Dans les deux cas → validation C-01 → PDN figé + hashé.

import type { PlanDeDeploiementNormalise } from './pdn';
import type { ContratRepo } from './repo-contract';

export interface SourceInput {
  repo_url: string;
  ref?: string;
  /** Jamais loggé (CLAUDE.md §8). */
  git_token?: string;
}

/** Résultat d'analyse statique d'un dépôt (utilisé par GitAdapter et ContractGenerator). */
export interface RepoAnalysis {
  repo_url?: string;
  has_dockerfile: boolean;
  has_compose_file: boolean;
  has_gamad_json: boolean;
  detected_files?: string[];
  detected_framework?: string;
  detected_language?: string;
  detected_runtime?: string;
}

/** Chemin A — le repo a un fichier contrat (INV-02). */
export interface TemplateCompiler {
  compile(contract: ContratRepo, input: SourceInput): PlanDeDeploiementNormalise;
}

/** Chemin B — repo brut, on infère (jamais si contrat présent). */
export interface GitAdapter {
  adapt(input: SourceInput, analysis: RepoAnalysis): Promise<PlanDeDeploiementNormalise>;
}

export interface SourceResolver {
  resolve(input: SourceInput): Promise<PlanDeDeploiementNormalise>;
}
