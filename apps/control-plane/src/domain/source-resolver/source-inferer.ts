// SourceInferer — inférence heuristique pure (Domain interne, non exposé dans packages/contracts).
// Chemin B de SourceResolver : aucun gamad.json → inférence depuis RepoAnalysis.
// Zéro I/O. Jamais appelé si rawContract est présent (INV-02).
//
// INVARIANT INV-01 : inférence par SIGNATURES TECHNIQUES uniquement.
// Aucun chemin par nom de plateforme commerciale. Un indice corrélé à un outil
// est traité exactement comme le même indice dans un projet générique.
// Preuve vérifiable : test grep zéro dans source-inferer.test.ts.
//
// Priorité de résolution : docker-compose > node > static.
// Résultat enrichi : InferenceResult { pdn, confidence, assumptions } consommé par
// SourceResolverService (extrait .pdn) et ContractGeneratorService (confidence + assumptions).

import type { PlanDeDeploiementNormalise, RepoAnalysis } from '@gamad/contracts';
import { validatePdn } from '../pdn/pdn-validator';

// ── Types exportés (internes au Domain) ──────────────────────────────────────

export interface InferenceResult {
  pdn: PlanDeDeploiementNormalise;
  confidence: number;
  /** Chaque inférence tracée — transparence pour l'utilisateur via le draft C-13. */
  assumptions: string[];
}

// ── Types internes ────────────────────────────────────────────────────────────

interface Signals {
  hasCompose: boolean;
  hasNextConfig: boolean;
  isNodeFramework: boolean;
  hasViteConfig: boolean;
  isNodeRuntime: boolean;
  isReactOnly: boolean;
  hasIndexHtml: boolean;
  hasPackageJson: boolean;
  fw: string;
}

interface ArtifactResolution {
  kind: 'docker-compose' | 'node' | 'static';
  compose_file?: string;
  build_command?: string;
  start_command?: string;
  output_dir?: string;
  port: number;
  confidence: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const NODE_SERVER_FRAMEWORKS = ['express', 'fastify', 'koa', 'hapi', 'nest'];

// ── SourceInferer ─────────────────────────────────────────────────────────────

export class SourceInferer {
  infer(analysis: RepoAnalysis): InferenceResult {
    const assumptions: string[] = [];
    const signals = extractSignals(analysis);
    const resolution = resolveArtifact(signals, assumptions);

    const { kind, compose_file, build_command, start_command, output_dir, port, confidence } =
      resolution;

    // Pour les SPA statiques servis par nginx, le health check cible '/' (retourne l'index.html,
    // status 200). Pour node/docker-compose, '/health' est la convention.
    const healthPath = kind === 'static' ? '/' : '/health';

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
      artifact: {
        kind,
        ...(compose_file !== undefined ? { compose_file } : {}),
        ...(build_command !== undefined ? { build_command } : {}),
        ...(start_command !== undefined ? { start_command } : {}),
        ...(output_dir !== undefined ? { output_dir } : {}),
      },
      env_vars: [],
      runtime: { ports: { http: port } },
      proxy: {
        paths: { '/': { target: `http://localhost:${port}` } },
        https: true,
      },
      health_checks: [
        {
          name: 'default',
          url: `http://localhost:${port}${healthPath}`,
          expected_status: 200,
          timeout_s: 30,
          attempts: 3,
          interval_s: 10,
        },
      ],
      policies: { ban_latest: false, on_error_stop: true },
    };

    validatePdn(pdn);
    return { pdn, confidence, assumptions };
  }
}

// ── Extraction des signaux (table plate, aucun nom de plateforme) ──────────────

function extractSignals(analysis: RepoAnalysis): Signals {
  const files = new Set(analysis.detected_files ?? []);
  const fw = (analysis.detected_framework ?? '').toLowerCase();
  const rt = (analysis.detected_runtime ?? '').toLowerCase();

  return {
    // Signal infrastructure (priorité absolue)
    hasCompose:
      analysis.has_compose_file ||
      files.has('docker-compose.yml') ||
      files.has('docker-compose.yaml'),

    // Signaux config-file (forts : fichier de configuration spécifique présent)
    hasNextConfig:
      files.has('next.config.js') || files.has('next.config.ts') || fw.includes('next'),
    hasViteConfig:
      files.has('vite.config.ts') || files.has('vite.config.js') || fw === 'vite',

    // Signaux framework serveur Node.js
    isNodeFramework: NODE_SERVER_FRAMEWORKS.some((f) => fw.includes(f)),

    // Signal runtime (détecté par l'analyseur GitAdapter)
    isNodeRuntime: fw === 'node' || rt === 'node' || rt === 'bun',

    // React sans Vite/Next → SPA CRA convention
    isReactOnly:
      fw.includes('react') &&
      !files.has('vite.config.ts') &&
      !files.has('vite.config.js') &&
      !fw.includes('next'),

    // Signaux fichiers génériques
    hasIndexHtml: files.has('index.html'),
    hasPackageJson: files.has('package.json'),

    fw,
  };
}

// ── Résolution par priorité : docker-compose > node > static ──────────────────

function resolveArtifact(signals: Signals, assumptions: string[]): ArtifactResolution {
  // Priorité 1 : docker-compose (signal infrastructure — aucun framework ne le contredit)
  if (signals.hasCompose) {
    assumptions.push(
      'docker-compose.yml détecté — kind=docker-compose (signal infrastructure, priorité absolue)',
    );
    return { kind: 'docker-compose', compose_file: 'docker-compose.yml', port: 8080, confidence: 0.90 };
  }

  // Priorité 2 : Next.js (fichier de config → serveur SSR Node)
  if (signals.hasNextConfig) {
    assumptions.push(
      'next.config.{js,ts} détecté — kind=node (SSR), build: npm run build, start: npm start, port 3000',
    );
    return {
      kind: 'node',
      build_command: 'npm run build',
      start_command: 'npm start',
      port: 3000,
      confidence: 0.85,
    };
  }

  // Priorité 3 : framework serveur Node.js reconnu
  if (signals.isNodeFramework) {
    assumptions.push(
      `Framework serveur détecté (${signals.fw}) — kind=node, start: npm start, port 3000`,
    );
    return { kind: 'node', start_command: 'npm start', port: 3000, confidence: 0.75 };
  }

  // Priorité 4 : Vite (fichier de config ou détection framework → SPA statique)
  if (signals.hasViteConfig) {
    assumptions.push(
      'vite.config.{ts,js} détecté — kind=static, build: npm run build, output: dist, port 80',
    );
    return {
      kind: 'static',
      build_command: 'npm run build',
      output_dir: 'dist',
      port: 80,
      confidence: 0.85,
    };
  }

  // Priorité 5 : runtime Node.js (signal plus faible, sans framework identifié)
  if (signals.isNodeRuntime) {
    assumptions.push(
      `Runtime Node.js détecté (${signals.fw || 'node'}) — kind=node, start: npm start, port 3000`,
    );
    return { kind: 'node', start_command: 'npm start', port: 3000, confidence: 0.55 };
  }

  // Priorité 6 : React sans Vite/Next (CRA convention)
  if (signals.isReactOnly) {
    assumptions.push(
      'React détecté sans Vite/Next — kind=static (CRA convention), build: npm run build, output: build, port 80',
    );
    return {
      kind: 'static',
      build_command: 'npm run build',
      output_dir: 'build',
      port: 80,
      confidence: 0.60,
    };
  }

  // Priorité 7 : HTML statique pur (pas de package.json → pas de build step)
  if (signals.hasIndexHtml && !signals.hasPackageJson) {
    assumptions.push('index.html sans package.json — site statique pur, port 80');
    return { kind: 'static', port: 80, confidence: 0.70 };
  }

  // Priorité 8 : package.json seul (signal faible, convention npm build)
  if (signals.hasPackageJson) {
    assumptions.push(
      'package.json présent sans framework reconnu — kind=static par défaut, confidence réduite',
    );
    return {
      kind: 'static',
      build_command: 'npm run build',
      output_dir: 'dist',
      port: 80,
      confidence: 0.35,
    };
  }

  // Priorité 9 : zéro indice exploitable
  assumptions.push('Aucun indice technique exploitable — kind=static par défaut');
  return { kind: 'static', port: 80, confidence: 0.20 };
}
