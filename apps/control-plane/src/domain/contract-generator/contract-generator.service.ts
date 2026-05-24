// Implémentation de ContractGenerator.generate() (C-13).
// Produit un draft gamad.json avec confidence + assumptions + warnings.
// Délègue l'inférence à SourceInferer (source unique de vérité, P-07) :
//   confidence + assumptions viennent de l'inférence réelle, pas d'un doublon.
// L'info riche (confidence faible) alerte l'utilisateur pour qu'il fournisse un gamad.json.
// commitToRepo() est I/O (P-04/P-06) — lève une erreur explicite ici.

import type {
  CommitContractParams,
  CommitResult,
  ContractGenerator,
  ContratRepo,
  GamadContractDraft,
  RepoAnalysis,
} from '@gamad/contracts';
import { SourceInferer } from '../source-resolver/source-inferer';

export class ContractGeneratorService implements ContractGenerator {
  private readonly inferer = new SourceInferer();

  generate(analysis: RepoAnalysis): GamadContractDraft {
    const { pdn, confidence, assumptions } = this.inferer.infer(analysis);
    const warnings: string[] = [];

    warnings.push(
      'health.checks[0].path est une estimation — vérifier le chemin réel avant déploiement',
    );
    if (confidence < 0.50) {
      warnings.push(
        `Inférence insuffisante (confidence=${confidence}) — revoir artifact_type, ports et health checks avant commit`,
      );
    }

    const contract: ContratRepo = {
      contract_version: '1.0',
      name: inferName(analysis),
      artifact_type: pdn.artifact.kind,
      source_ref: analysis.ref ?? { type: 'branch', value: 'main' },
      runtime: {
        ...(pdn.artifact.compose_file !== undefined
          ? { compose_file: pdn.artifact.compose_file }
          : {}),
        ports: pdn.runtime.ports,
      },
      env: [],
      health: {
        checks: [{ name: 'default', path: '/health', expected_status: 200, timeout_s: 30 }],
      },
      policies: { ban_latest: false, on_error_stop: true },
    };

    return { contract, confidence, assumptions, warnings };
  }

  commitToRepo(_params: CommitContractParams): Promise<CommitResult> {
    return Promise.reject(
      new Error('commitToRepo nécessite un GitAdapter (I/O) — implémenté en P-04'),
    );
  }
}

function inferName(analysis: RepoAnalysis): string {
  if (!analysis.repo_url) return 'app';
  const parts = analysis.repo_url.split('/');
  return parts[parts.length - 1]?.replace(/\.git$/, '') ?? 'app';
}
