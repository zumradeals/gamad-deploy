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
  GeneratedFile,
  RepoAnalysis,
} from '@gamad/contracts';
import type { PlanDeDeploiementNormalise } from '@gamad/contracts';
import { SourceInferer } from '../source-resolver/source-inferer';

export class ContractGeneratorService implements ContractGenerator {
  private readonly inferer = new SourceInferer();

  generate(analysis: RepoAnalysis): GamadContractDraft {
    const { pdn, confidence, assumptions } = this.inferer.infer(analysis);
    const warnings: string[] = [];

    if (confidence < 0.50) {
      warnings.push(
        `Inférence insuffisante (confidence=${confidence}) — revoir artifact_type, ports et health checks avant commit`,
      );
    }

    // La normalisation crée toujours un docker-compose.yml dans le repo.
    // artifact_type est donc toujours 'docker-compose' après normalisation (INV-02).
    const generated_files = buildGeneratedFiles(pdn);

    // Extraire le path depuis l'URL du PDN (source de vérité : SourceInferer).
    // Apps statiques → '/', apps node/docker-compose → '/health'.
    const healthCheckUrl = pdn.health_checks[0]?.url ?? '';
    const healthCheckPath = healthCheckUrl
      ? (() => { try { return new URL(healthCheckUrl).pathname; } catch { return '/health'; } })()
      : (pdn.artifact.kind === 'static' ? '/' : '/health');

    const contract: ContratRepo = {
      contract_version: '1.0',
      name: inferName(analysis),
      artifact_type: 'docker-compose',
      source_ref: analysis.ref ?? { type: 'branch', value: 'main' },
      runtime: {
        compose_file: 'docker-compose.yml',
        ports: pdn.runtime.ports,
      },
      env: [],
      health: {
        checks: [{ name: 'default', path: healthCheckPath, expected_status: 200, timeout_s: 30 }],
      },
      policies: { ban_latest: false, on_error_stop: true },
    };

    return {
      contract,
      confidence,
      assumptions,
      warnings,
      ...(generated_files.length > 0 ? { generated_files } : {}),
    };
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

function buildGeneratedFiles(pdn: PlanDeDeploiementNormalise): GeneratedFile[] {
  const port = pdn.runtime.ports.http ?? 3000;
  const { kind, build_command, start_command, output_dir } = pdn.artifact;

  if (kind === 'docker-compose') return [];

  if (kind === 'static') {
    const distDir = output_dir ?? 'dist';
    const buildCmd = build_command ?? 'npm run build';
    return [
      {
        path: 'nginx.conf',
        content:
          'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n' +
          '  location / { try_files $uri $uri/ /index.html; }\n}\n',
      },
      {
        path: 'Dockerfile',
        content:
          `FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY . .\n` +
          `RUN npm install\nRUN ${buildCmd}\n` +
          `FROM nginx:alpine\n` +
          `COPY --from=builder /app/${distDir} /usr/share/nginx/html\n` +
          `COPY nginx.conf /etc/nginx/conf.d/default.conf\nEXPOSE 80\n`,
      },
      {
        path: 'docker-compose.yml',
        // APP_HOST_PORT est injecté par l'agent GAMAD au moment du déploiement
        // (port hôte stable unique par deploymentId, plage 10000–59999).
        // Valeur par défaut 8080 pour `docker compose up` en local hors GAMAD.
        content:
          `services:\n  app:\n    build:\n      context: .\n      dockerfile: Dockerfile\n` +
          `    ports:\n      - "\${APP_HOST_PORT:-8080}:80"\n    restart: unless-stopped\n`,
      },
    ];
  }

  // node kind
  const startCmd = start_command ?? 'npm start';
  const buildLine = build_command ? `\nRUN ${build_command}` : '';
  return [
    {
      path: 'Dockerfile',
      content:
        `FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install${buildLine}\n` +
        `EXPOSE ${port}\nCMD ${JSON.stringify(startCmd.split(' '))}\n`,
    },
    {
      path: 'docker-compose.yml',
      content:
        `services:\n  app:\n    build:\n      context: .\n      dockerfile: Dockerfile\n` +
        `    ports:\n      - "\${APP_HOST_PORT:-${port}}:${port}"\n    restart: unless-stopped\n`,
    },
  ];
}
