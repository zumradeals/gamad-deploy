// Chemin A de SourceResolver : gamad.json présent et valide (INV-02).
// Compile un ContratRepo + RepoAnalysis → PDN. Synchrone, zéro I/O.
// La conversion path relatif → URL complète (C-02 vs C-01) se fait ici.

import type {
  ContratRepo,
  HealthCheck,
  PlanDeDeploiementNormalise,
  RepoAnalysis,
  TemplateCompiler,
} from '@gamad/contracts';
import { validatePdn } from '../pdn/pdn-validator';

export class TemplateCompilerService implements TemplateCompiler {
  compile(contract: ContratRepo, analysis: RepoAnalysis): PlanDeDeploiementNormalise {
    const port = this.primaryPort(contract);

    // Conversion C-02 path relatif → C-01 URL complète (INV-03 : chemin ≠ URL)
    const healthChecks = contract.health.checks.map<HealthCheck>((hc) => ({
      name: hc.name,
      url: `http://localhost:${port}${hc.path}`,
      expected_status: hc.expected_status,
      timeout_s: hc.timeout_s,
      attempts: 3,
      interval_s: 10,
    })) as [HealthCheck, ...HealthCheck[]];

    const pdn: PlanDeDeploiementNormalise = {
      pdn_version: '1.0',
      source: {
        type: 'git',
        url: analysis.repo_url ?? '',
        // ref résolue au moment du clone prime sur la ref déclarée dans le contrat
        ref: analysis.ref ?? contract.source_ref,
        fingerprint: {
          ...(analysis.commit_sha !== undefined ? { commit_sha: analysis.commit_sha } : {}),
        },
      },
      artifact: {
        kind: contract.artifact_type,
        ...(contract.runtime.compose_file !== undefined ? { compose_file: contract.runtime.compose_file } : {}),
      },
      env_vars: contract.env.map((e) => ({
        name: e.name,
        required: e.required,
        secret: e.secret,
        ...(e.default !== undefined ? { default: e.default } : {}),
      })),
      runtime: { ports: contract.runtime.ports },
      proxy: {
        paths: { '/': { target: `http://localhost:${port}` } },
        https: true,
      },
      health_checks: healthChecks,
      policies: contract.policies,
    };

    validatePdn(pdn);
    return pdn;
  }

  private primaryPort(contract: ContratRepo): number {
    return contract.runtime.ports['http'] ?? Object.values(contract.runtime.ports)[0] ?? 3000;
  }
}
