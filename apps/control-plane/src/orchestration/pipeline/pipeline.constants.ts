// C-05 — Noms de queue et d'étapes du pipeline de déploiement.
// Source de vérité : tout job enqueued/processed utilise ces constantes.

export const PIPELINE_QUEUE = 'pipeline';

export const REDIS_CONNECTION = 'REDIS_CONNECTION';

export enum JobName {
  RESOLVE_SOURCE = 'resolve-source',
  PROVISION_DB   = 'provision-db',
  MIGRATE_DATA   = 'migrate-data',
  DISPATCH_AGENT = 'dispatch-agent',
  AWAIT_HEALTH   = 'await-health',
}

// BullMQ job options par défaut : 3 tentatives, backoff exponentiel (2s, 4s, 8s).
// await-health surcharge attempts=1 — le retry interne est géré par la boucle de poll.
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: true,
  removeOnFail: false,
} as const;

export const AWAIT_HEALTH_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 1,
} as const;
