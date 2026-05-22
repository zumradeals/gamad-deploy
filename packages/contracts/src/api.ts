// C-12 — API publique (Delivery : REST + WebSocket)
// La couche Delivery valide et délègue — elle ne décide jamais d'une règle métier.
// Toute entrée est validée par un schéma Zod avant d'atteindre le Domain.
// Le suivi temps réel lit les événements d'audit (C-11), il n'invente jamais d'état.

export type DeploymentStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ROLLED_BACK';

export interface CreateProjectRequest {
  org_id: string;    // UUID v4
  name: string;
  repo_url: string;
  server_id: string; // UUID v4
}

export interface CreateProjectResponse {
  project_id: string; // UUID v4
}

export interface LaunchDeploymentRequest {
  project_id: string; // UUID v4
  ref?: string;
  /** Jamais loggé (CLAUDE.md §8). */
  git_token?: string;
}

export interface LaunchDeploymentResponse {
  deployment_id: string; // UUID v4
}

export interface DeploymentStatusResponse {
  deployment_id: string; // UUID v4
  state: DeploymentStatus;
  created_at: string;    // ISO 8601
  updated_at: string;    // ISO 8601
}

export interface BillingCheckoutRequest {
  org_id: string; // UUID v4
  plan: string;
  return_url: string;
}

export interface BillingCheckoutResponse {
  payment_url: string;
}

// WebSocket — WS /deployments/:id/stream
export type StreamEventType =
  | 'log'
  | 'step_started'
  | 'step_done'
  | 'health_result'
  | 'finished';

export interface StreamEvent {
  type: StreamEventType;
  deployment_id: string; // UUID v4
  timestamp: string;     // ISO 8601
  data?: Record<string, unknown>;
}
