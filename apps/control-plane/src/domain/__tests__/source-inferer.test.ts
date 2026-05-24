// Tests de SourceInferer (P-07).
// Prouve les garanties P-07 :
//   1. INV-01 : inférence par signatures techniques, zéro chemin par marque (grep zéro)
//   2. Vite générique et fixtures "plateforme-like" → PDN IDENTIQUE par le MÊME chemin
//   3. Signaux conflictuels → priorité docker-compose > node > static, tracée en assumptions
//   4. Zéro indice → PDN statique confidence=0.20, valide (passe validatePdn)
//   5. InferenceResult { pdn, confidence, assumptions } consommable par ContractGenerator

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import type { RepoAnalysis } from '@gamad/contracts';
import { SourceInferer } from '../source-resolver/source-inferer';

const inferer = new SourceInferer();

// ── Fixtures ──────────────────────────────────────────────────────────────────

// SPA Vite générique — aucun artefact de plateforme, que des indices techniques
const VITE_GENERIC: RepoAnalysis = {
  has_dockerfile: false,
  has_compose_file: false,
  has_gamad_json: false,
  detected_framework: 'vite',
  detected_files: ['vite.config.ts', 'package.json'],
};

// Même classe technique que Vite générique + fichiers non-signifiants supplémentaires
const LOVABLE_LIKE: RepoAnalysis = {
  has_dockerfile: false,
  has_compose_file: false,
  has_gamad_json: false,
  detected_framework: 'vite',
  detected_files: [
    'vite.config.ts',
    'package.json',
    'tailwind.config.js',
    'postcss.config.js',
    'src/App.tsx',
    'src/main.tsx',
  ],
};

// Node serveur générique (express)
const NODE_GENERIC: RepoAnalysis = {
  has_dockerfile: false,
  has_compose_file: false,
  has_gamad_json: false,
  detected_framework: 'express',
  detected_files: ['package.json', 'index.js'],
};

// Même classe technique que Node générique + fichiers supplémentaires
const BOLT_LIKE: RepoAnalysis = {
  has_dockerfile: false,
  has_compose_file: false,
  has_gamad_json: false,
  detected_framework: 'express',
  detected_files: ['package.json', 'server.ts', 'src/routes.ts', 'src/middleware.ts'],
};

// Node via runtime + replit.nix (indice de fichier neutre, aucune branche dédiée)
const REPLIT_LIKE: RepoAnalysis = {
  has_dockerfile: false,
  has_compose_file: false,
  has_gamad_json: false,
  detected_framework: 'node',
  detected_files: ['package.json', 'index.js', 'replit.nix'],
  detected_runtime: 'node',
};

// Node générique via runtime uniquement (référence pour comparaison Replit-like)
const NODE_RUNTIME_GENERIC: RepoAnalysis = {
  has_dockerfile: false,
  has_compose_file: false,
  has_gamad_json: false,
  detected_framework: 'node',
  detected_files: ['package.json', 'index.js'],
  detected_runtime: 'node',
};

// ── Tests INV-01 : grep zéro plateforme ───────────────────────────────────────

describe('SourceInferer — INV-01 : zéro chemin par marque (grep)', () => {
  test('source-inferer.ts ne contient aucun nom de plateforme commerciale', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../source-resolver/source-inferer.ts', import.meta.url)),
      'utf-8',
    );
    const forbidden = ['lovable', 'bolt', 'replit', 'cursor', 'v0'];
    for (const word of forbidden) {
      expect(
        src.toLowerCase(),
        `"${word}" trouvé dans source-inferer.ts — violation INV-01`,
      ).not.toContain(word);
    }
  });
});

// ── Tests Vite / SPA statique ─────────────────────────────────────────────────

describe('SourceInferer — Vite / SPA statique', () => {
  test('Vite générique → kind=static, build=npm run build, output=dist, port=80', () => {
    const result = inferer.infer(VITE_GENERIC);
    expect(result.pdn.artifact.kind).toBe('static');
    expect(result.pdn.artifact.build_command).toBe('npm run build');
    expect(result.pdn.artifact.output_dir).toBe('dist');
    expect(result.pdn.runtime.ports.http).toBe(80);
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
  });

  test('Lovable-like → artifact et runtime IDENTIQUES au Vite générique (même chemin, même résultat)', () => {
    const generic = inferer.infer(VITE_GENERIC);
    const lovable = inferer.infer(LOVABLE_LIKE);
    // Les fichiers supplémentaires (tailwind, postcss, src/) ne modifient pas l'inférence
    expect(lovable.pdn.artifact).toEqual(generic.pdn.artifact);
    expect(lovable.pdn.runtime).toEqual(generic.pdn.runtime);
    expect(lovable.confidence).toBe(generic.confidence);
  });

  test('vite.config.ts en detected_files (sans detected_framework) → même résultat', () => {
    const result = inferer.infer({
      has_dockerfile: false,
      has_compose_file: false,
      has_gamad_json: false,
      detected_files: ['vite.config.ts', 'package.json'],
    });
    expect(result.pdn.artifact.kind).toBe('static');
    expect(result.pdn.artifact.output_dir).toBe('dist');
  });
});

// ── Tests Node serveur ────────────────────────────────────────────────────────

describe('SourceInferer — Node serveur', () => {
  test('Node générique (express) → kind=node, start=npm start, port=3000', () => {
    const result = inferer.infer(NODE_GENERIC);
    expect(result.pdn.artifact.kind).toBe('node');
    expect(result.pdn.artifact.start_command).toBe('npm start');
    expect(result.pdn.runtime.ports.http).toBe(3000);
    expect(result.confidence).toBeGreaterThanOrEqual(0.70);
  });

  test('Bolt-like → artifact et runtime IDENTIQUES au Node générique (même chemin, même résultat)', () => {
    const generic = inferer.infer(NODE_GENERIC);
    const bolt = inferer.infer(BOLT_LIKE);
    expect(bolt.pdn.artifact).toEqual(generic.pdn.artifact);
    expect(bolt.pdn.runtime).toEqual(generic.pdn.runtime);
    expect(bolt.confidence).toBe(generic.confidence);
  });

  test('Replit-like → kind=node, replit.nix ignoré comme signal de marque', () => {
    const generic = inferer.infer(NODE_RUNTIME_GENERIC);
    const replit = inferer.infer(REPLIT_LIKE);
    // replit.nix dans detected_files n'introduit aucun chemin dédié
    expect(replit.pdn.artifact.kind).toBe('node');
    expect(replit.pdn.runtime.ports.http).toBe(generic.pdn.runtime.ports.http);
    expect(replit.confidence).toBe(generic.confidence);
  });

  test('Next.js (next.config.js) → kind=node, build + start commands, confidence >= 0.80', () => {
    const result = inferer.infer({
      has_dockerfile: false,
      has_compose_file: false,
      has_gamad_json: false,
      detected_files: ['next.config.js', 'package.json'],
    });
    expect(result.pdn.artifact.kind).toBe('node');
    expect(result.pdn.artifact.build_command).toBe('npm run build');
    expect(result.pdn.artifact.start_command).toBe('npm start');
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
  });
});

// ── Tests signaux conflictuels — priorité docker-compose > node > static ──────

describe('SourceInferer — signaux conflictuels', () => {
  test('docker-compose + vite → kind=docker-compose (infrastructure prime sur framework)', () => {
    const result = inferer.infer({
      has_dockerfile: false,
      has_compose_file: true,
      has_gamad_json: false,
      detected_framework: 'vite',
      detected_files: ['vite.config.ts', 'docker-compose.yml'],
    });
    expect(result.pdn.artifact.kind).toBe('docker-compose');
    expect(result.confidence).toBe(0.90);
  });

  test('docker-compose + express → kind=docker-compose', () => {
    const result = inferer.infer({
      has_dockerfile: false,
      has_compose_file: true,
      has_gamad_json: false,
      detected_framework: 'express',
      detected_files: ['docker-compose.yml', 'package.json'],
    });
    expect(result.pdn.artifact.kind).toBe('docker-compose');
  });

  test('docker-compose gagnant → assumption contient "priorité absolue"', () => {
    const result = inferer.infer({
      has_dockerfile: false,
      has_compose_file: true,
      has_gamad_json: false,
      detected_framework: 'vite',
      detected_files: ['vite.config.ts', 'docker-compose.yml'],
    });
    expect(result.assumptions.some((a) => a.includes('priorité absolue'))).toBe(true);
  });
});

// ── Tests zéro indice — dégradation gracieuse ─────────────────────────────────

describe('SourceInferer — zéro indice', () => {
  const EMPTY: RepoAnalysis = { has_dockerfile: false, has_compose_file: false, has_gamad_json: false };

  test('aucun signal → kind=static, port=80, confidence=0.20', () => {
    const result = inferer.infer(EMPTY);
    expect(result.pdn.artifact.kind).toBe('static');
    expect(result.pdn.runtime.ports.http).toBe(80);
    expect(result.confidence).toBe(0.20);
  });

  test('zéro indice → PDN valide (passe validatePdn — INV-03 et pdn_version)', () => {
    // validatePdn est appelé dans infer() — si le PDN est invalide, cela lèverait ici
    expect(() => inferer.infer(EMPTY)).not.toThrow();
    const result = inferer.infer(EMPTY);
    expect(result.pdn.pdn_version).toBe('1.0');
    expect(result.pdn.health_checks.length).toBeGreaterThanOrEqual(1);
  });

  test('zéro indice → assumptions non vide (transparence sur le défaut)', () => {
    const result = inferer.infer(EMPTY);
    expect(result.assumptions.length).toBeGreaterThanOrEqual(1);
    expect(result.assumptions[0]).toContain('Aucun indice');
  });
});

// ── Tests autres classes techniques ──────────────────────────────────────────

describe('SourceInferer — autres classes', () => {
  test('HTML statique pur (index.html sans package.json) → kind=static, confidence=0.70', () => {
    const result = inferer.infer({
      has_dockerfile: false,
      has_compose_file: false,
      has_gamad_json: false,
      detected_files: ['index.html', 'style.css', 'script.js'],
    });
    expect(result.pdn.artifact.kind).toBe('static');
    expect(result.pdn.runtime.ports.http).toBe(80);
    expect(result.confidence).toBe(0.70);
  });

  test('React sans Vite/Next → kind=static (CRA convention), output=build', () => {
    const result = inferer.infer({
      has_dockerfile: false,
      has_compose_file: false,
      has_gamad_json: false,
      detected_framework: 'react',
      detected_files: ['package.json', 'src/App.jsx'],
    });
    expect(result.pdn.artifact.kind).toBe('static');
    expect(result.pdn.artifact.output_dir).toBe('build');
    expect(result.confidence).toBe(0.60);
  });

  test('InferenceResult.assumptions est consommable (non vide pour tout appel)', () => {
    for (const fixture of [VITE_GENERIC, NODE_GENERIC, BOLT_LIKE, LOVABLE_LIKE]) {
      const result = inferer.infer(fixture);
      expect(result.assumptions.length, `assumptions vide pour ${fixture.detected_framework}`).toBeGreaterThan(0);
    }
  });
});
