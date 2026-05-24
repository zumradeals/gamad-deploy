// Implémentation de SourceResolver (C-03).
// Orchestre TemplateCompilerService (chemin A) et SourceInferer (chemin B).
// Règle figée (ADR-0006) : rawContract présent → compile ; sinon → infer.
// Zéro I/O. Synchrone. Testable par injection de RepoAnalysis fixe.

import type { PlanDeDeploiementNormalise, RepoAnalysis, SourceResolver } from '@gamad/contracts';
import { ContratRepoSchema } from '@gamad/contracts';
import { SourceInferer } from './source-inferer';
import { TemplateCompilerService } from './template-compiler.service';

export class SourceResolverService implements SourceResolver {
  private readonly compiler = new TemplateCompilerService();
  private readonly inferer = new SourceInferer();

  resolve(analysis: RepoAnalysis): PlanDeDeploiementNormalise {
    if (analysis.rawContract !== undefined) {
      return this.resolveFromContract(analysis.rawContract, analysis);
    }
    return this.inferer.infer(analysis).pdn;
  }

  private resolveFromContract(
    raw: string,
    analysis: RepoAnalysis,
  ): PlanDeDeploiementNormalise {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('gamad.json invalide : JSON malformé');
    }

    const result = ContratRepoSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`gamad.json invalide : ${result.error.message}`);
    }

    return this.compiler.compile(result.data, analysis);
  }
}
