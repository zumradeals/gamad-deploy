// C-03 — SourceResolver : Compiler + Inferer
// Transformer une RepoAnalysis (déjà produite par la couche Adapters) en PDN.
// Deux chemins, une seule sortie (INV-01).
// Règle figée : rawContract présent → TemplateCompiler (INV-02) ; sinon → SourceInferer (interne Domain).
// Dans les deux cas → validatePdn() → PDN figé avant exécution.
// Pas de I/O : resolve() est synchrone. Toute lecture réseau/filesystem vit dans GitAdapter (Adapters).

import type { PlanDeDeploiementNormalise } from './pdn';
import type { ContratRepo } from './repo-contract';

/** Credentials bruts pour atteindre un repo (utilisé par GitAdapter, couche Adapters). */
export interface SourceInput {
  repo_url: string;
  ref?: string;
  /** Jamais loggé (CLAUDE.md §8). */
  git_token?: string;
}

/**
 * Résultat de l'analyse statique d'un dépôt.
 * Produit par GitAdapter (Adapters, I/O) et reçu en entrée par SourceResolver (Domain, pur).
 * Utilisé aussi par ContractGenerator (C-13).
 */
export interface RepoAnalysis {
  repo_url?: string;
  /** Ref résolue au moment du clone (commit SHA, tag, branche). */
  ref?: { type: 'branch' | 'tag' | 'commit'; value: string };
  /** SHA du commit analysé. */
  commit_sha?: string;
  has_dockerfile: boolean;
  has_compose_file: boolean;
  has_gamad_json: boolean;
  /** Contenu brut du gamad.json si trouvé — parsé et validé par le Domain, jamais par l'Adapter. */
  rawContract?: string;
  detected_files?: string[];
  detected_framework?: string;
  detected_language?: string;
  detected_runtime?: string;
}

/**
 * Chemin A — le repo a un gamad.json valide (INV-02 : contrat prime sur toute inférence).
 * Implémenté dans la couche Domain. Synchrone (pur).
 */
export interface TemplateCompiler {
  compile(contract: ContratRepo, analysis: RepoAnalysis): PlanDeDeploiementNormalise;
}

/**
 * Port I/O — implémenté dans la couche Adapters en P-04. JAMAIS dans le Domain.
 * Prend un SourceInput (credentials inclus), clone le repo, lit les fichiers,
 * et retourne un RepoAnalysis. La transformation RepoAnalysis → PDN se fait ensuite
 * dans le Domain via SourceResolver.
 */
export interface GitAdapter {
  analyze(input: SourceInput): Promise<RepoAnalysis>;
}

/**
 * Entrée du Domain : reçoit une RepoAnalysis déjà construite (par GitAdapter ou tout autre I/O).
 * Retourne un PDN synchrone et validé. Zéro I/O — 100 % testable hors-ligne.
 */
export interface SourceResolver {
  resolve(analysis: RepoAnalysis): PlanDeDeploiementNormalise;
}
