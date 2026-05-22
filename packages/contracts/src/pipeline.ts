// C-05 — Pipeline & Étapes (Jobs BullMQ)
// Décompose un déploiement en étapes idempotentes, traçables, ré-essayables (INV-07).
// Chaque étape rejouée ne duplique pas. Échec critique → on_error_stop → FAILED (INV-08).

export type JobName =
  | 'resolve-source'
  | 'provision-db'
  | 'migrate-data'
  | 'dispatch-agent'
  | 'await-health';

export interface JobDefinition {
  name: JobName;
  timeout_ms: number;
  max_retries: number;
  /** Clé d'idempotence : rejoué avec la même clé, le job ne duplique pas (INV-07). */
  idempotency_key: string;
}

export interface PipelineContext {
  deployment_id: string; // UUID v4 (INV-05)
  org_id: string;        // UUID v4 (INV-05)
  project_id: string;    // UUID v4 (INV-05)
}

export interface JobResult {
  job: JobName;
  status: 'success' | 'failure';
  payload?: Record<string, unknown>;
}
