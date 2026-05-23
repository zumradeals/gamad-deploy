// C-05 — Noms de queue et d'étapes du pipeline de déploiement.
// Source de vérité : tout job enqueued/processed utilise ces constantes.

export const PIPELINE_QUEUE = 'pipeline';

export const REDIS_CONNECTION = 'REDIS_CONNECTION';

// Tokens d'injection NestJS — utilisés avec @Inject() explicite (INV-07 DI debt P-04).
// Évite toute dépendance à emitDecoratorMetadata dans les processors.
export const PIPELINE_QUEUE_TOKEN = 'PIPELINE_QUEUE_TOKEN';
export const AWAIT_HEALTH_INTERVAL_MS = 'AWAIT_HEALTH_INTERVAL_MS';
export const AWAIT_HEALTH_MAX_ATTEMPTS = 'AWAIT_HEALTH_MAX_ATTEMPTS';

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
