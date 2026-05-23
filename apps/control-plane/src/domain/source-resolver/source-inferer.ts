// SourceInferer — logique heuristique pure (Domain interne, non exposé dans packages/contracts).
// Chemin B de SourceResolver : aucun gamad.json → inférence depuis RepoAnalysis.
// Zéro I/O. Jamais appelé si rawContract est présent (INV-02).

import type { PlanDeDeploiementNormalise, RepoAnalysis } from '@gamad/contracts';
import { validatePdn } from '../pdn/pdn-validator';

export class SourceInferer {
  infer(analysis: RepoAnalysis): PlanDeDeploiementNormalise {
    const kind = this.inferArtifactKind(analysis);
    const port = kind === 'static' ? 80 : 3000;

    const pdn: PlanDeDeploiementNormalise = {
      pdn_version: '1.0',
      source: {
        type: 'git',
        url: analysis.repo_url ?? '',
        ref: analysis.ref ?? { type: 'branch', value: 'main' },
        fingerprint: {
          ...(analysis.commit_sha !== undefined ? { commit_sha: analysis.commit_sha } : {}),
        },
      },
      artifact: { kind },
      env_vars: [],
      runtime: { ports: { http: port } },
      proxy: {
        paths: { '/': { target: `http://localhost:${port}` } },
        https: true,
      },
      health_checks: [
        {
          name: 'default',
          url: `http://localhost:${port}/health`,
          expected_status: 200,
          timeout_s: 30,
          attempts: 3,
          interval_s: 10,
        },
      ],
      policies: { ban_latest: false, on_error_stop: true },
    };

    validatePdn(pdn);
    return pdn;
  }

  private inferArtifactKind(
    analysis: RepoAnalysis,
  ): 'docker-compose' | 'node' | 'static' {
    if (analysis.has_compose_file) return 'docker-compose';
    const nodeIndicators = ['node', 'express', 'next', 'nest', 'fastify', 'koa'];
    const fw = analysis.detected_framework?.toLowerCase() ?? '';
    const rt = analysis.detected_runtime?.toLowerCase() ?? '';
    if (nodeIndicators.some((i) => fw.includes(i) || rt.includes(i))) return 'node';
    return 'static';
  }
}
