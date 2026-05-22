// C-11 — Journal d'audit immuable (INSERT-only + hash)
// INV-04 : aucun UPDATE ni DELETE sur ces tables — garanti au niveau base par trigger.
// Toutes les propriétés sont readonly pour signaler l'immuabilité dès la couche TypeScript.
// Une correction = un nouvel enregistrement, jamais une modification.

export interface DeploymentPlanRecord {
  readonly id: string;            // UUID v4 (INV-05)
  readonly deployment_id: string; // UUID v4
  readonly org_id: string;        // UUID v4
  /** PDN sérialisé JSON. */
  readonly plan_json: string;
  /** SHA-256 — prouve qu'un déploiement n'a pas été altéré a posteriori. */
  readonly plan_hash: string;
  readonly created_at: string;    // ISO 8601
}

export interface DeploymentLogRecord {
  readonly id: string;            // UUID v4
  readonly deployment_id: string; // UUID v4
  readonly event: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly payload?: Record<string, unknown>;
  readonly created_at: string;    // ISO 8601
}

export interface DeploymentStateTransitionRecord {
  readonly id: string;            // UUID v4
  readonly deployment_id: string; // UUID v4
  readonly from_state: string;
  readonly to_state: string;
  readonly created_at: string;    // ISO 8601
}

export interface PaymentTransactionRecord {
  readonly id: string;            // UUID v4
  readonly org_id: string;        // UUID v4
  readonly reference: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: 'success' | 'failed' | 'pending';
  /** SHA-256 du payload vérifié. */
  readonly payload_hash: string;
  readonly created_at: string;    // ISO 8601
}
