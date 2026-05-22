// C-02 — Fichier contrat du dépôt (gamad.json)
// Source de vérité si présent (INV-02). Validé par schéma Zod strict avant toute compilation.
// contract_version inconnue → refus explicite. Si présent, aucune heuristique ne le contredit.

import { z } from 'zod';

export const ContractVersionSchema = z.literal('1.0');

export const SourceRefSchema = z.object({
  type: z.enum(['branch', 'tag', 'commit']),
  value: z.string().min(1),
});

export const EnvVarSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Le nom doit être en UPPER_SNAKE_CASE'),
  required: z.boolean(),
  secret: z.boolean(),
  default: z.string().optional(),
});

export const HealthCheckSchema = z.object({
  name: z.string().min(1),
  path: z.string().startsWith('/'),
  expected_status: z.number().int().min(100).max(599),
  timeout_s: z.number().positive(),
});

export const PoliciesSchema = z.object({
  ban_latest: z.boolean(),
  on_error_stop: z.boolean(),
});

export const ContratRepoSchema = z.object({
  contract_version: ContractVersionSchema,
  name: z.string().min(1),
  artifact_type: z.enum(['docker-compose', 'node', 'static']),
  source_ref: SourceRefSchema,
  runtime: z.object({
    compose_file: z.string().optional(),
    ports: z.record(z.string(), z.number().int().positive()),
  }),
  env: z.array(EnvVarSchema),
  health: z.object({
    // INV-03 : au moins un health check
    checks: z.array(HealthCheckSchema).min(1, 'Au moins un health check est requis (INV-03)'),
  }),
  policies: PoliciesSchema,
});

export type ContratRepo = z.infer<typeof ContratRepoSchema>;
