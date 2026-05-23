// Implémentation de ContractGenerator.generate() (C-13).
// Produit un draft gamad.json avec confidence + assumptions + warnings.
// Pas de magie opaque : chaque inférence est tracée dans assumptions.
// commitToRepo() est I/O (P-04/P-06) — lève une erreur explicite ici.

import type {
  CommitContractParams,
  CommitResult,
  ContractGenerator,
  ContratRepo,
  GamadContractDraft,
  RepoAnalysis,
} from '@gamad/contracts';

export class ContractGeneratorService implements ContractGenerator {
  generate(analysis: RepoAnalysis): GamadContractDraft {
    const assumptions: string[] = [];
    const warnings: string[] = [];

    const { artifactType, port, confidence } = this.inferArtifact(analysis, assumptions, warnings);

    warnings.push('health.checks[0].path est une estimation — vérifier le chemin réel avant déploiement');

    const contract: ContratRepo = {
      contract_version: '1.0',
      name: this.inferName(analysis),
      artifact_type: artifactType,
      source_ref: analysis.ref ?? { type: 'branch', value: 'main' },
      runtime: {
        ...(artifactType === 'docker-compose' ? { compose_file: 'docker-compose.yml' } : {}),
        ports: { http: port },
      },
      env: [],
      health: {
        checks: [
          { name: 'default', path: '/health', expected_status: 200, timeout_s: 30 },
        ],
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

  private inferArtifact(
    analysis: RepoAnalysis,
    assumptions: string[],
    warnings: string[],
  ): { artifactType: ContratRepo['artifact_type']; port: number; confidence: number } {
    if (analysis.has_compose_file) {
      assumptions.push("docker-compose.yml détecté — artifact_type='docker-compose' supposé");
      return { artifactType: 'docker-compose', port: 8080, confidence: 0.75 };
    }

    const nodeIndicators = ['node', 'express', 'next', 'nest', 'fastify', 'koa'];
    const fw = analysis.detected_framework?.toLowerCase() ?? '';
    const rt = analysis.detected_runtime?.toLowerCase() ?? '';
    if (nodeIndicators.some((i) => fw.includes(i) || rt.includes(i))) {
      assumptions.push(`Runtime Node.js détecté (${analysis.detected_framework ?? analysis.detected_runtime}) — artifact_type='node' supposé`);
      return { artifactType: 'node', port: 3000, confidence: 0.60 };
    }

    if (analysis.detected_framework) {
      assumptions.push(`Framework "${analysis.detected_framework}" détecté — static supposé faute de mieux`);
      warnings.push("Vérifier artifact_type : pourrait nécessiter 'node' ou 'docker-compose'");
      return { artifactType: 'static', port: 80, confidence: 0.40 };
    }

    assumptions.push('Aucun indicateur fiable détecté — static par défaut');
    warnings.push('Inférence insuffisante — revoir artifact_type, health checks et ports manuellement');
    return { artifactType: 'static', port: 80, confidence: 0.20 };
  }

  private inferName(analysis: RepoAnalysis): string {
    if (!analysis.repo_url) return 'app';
    const parts = analysis.repo_url.split('/');
    return parts[parts.length - 1]?.replace(/\.git$/, '') ?? 'app';
  }
}
