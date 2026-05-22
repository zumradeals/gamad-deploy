// C-06 — Protocole Control Plane ↔ Agent
// C-07 — Contrat de l'Agent VPS
// L'agent est aveugle à la source (INV-01). Il ne décide jamais du SUCCESS final (INV-03).
// Authentification par agent_token unique par serveur. Callbacks journalisés en INSERT-only (C-11).

import type { PlanDeDeploiementNormalise } from './pdn';

// C-06 — Dispatch et callbacks

export interface ResolvedPlan extends PlanDeDeploiementNormalise {
  /** SHA-256 du PDN figé avant exécution (INV-04). */
  plan_hash: string;
}

/** POST http://{agent_host}:{agent_port}/deploy */
export interface AgentDispatchRequest {
  deployment_id: string; // UUID v4
  resolved_plan: ResolvedPlan;
  callback_url: string;
}

export type AgentCallbackEvent =
  | 'log'
  | 'step_started'
  | 'step_done'
  | 'health_result'
  | 'finished';

/** POST {callback_url} — poussé par l'agent vers le control plane. */
export interface AgentCallbackPayload {
  deployment_id: string; // UUID v4
  event: AgentCallbackEvent;
  level?: 'info' | 'warn' | 'error';
  message?: string;
  payload?: Record<string, unknown>;
}

// C-07 — Garanties de l'Agent VPS

export interface AgentHealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptime_s: number;
}

export interface Agent {
  /** Exécute un plan résolu : checkout → docker up → nginx → certbot. */
  deploy(request: AgentDispatchRequest): Promise<void>;
  /** GET /agent/health — supervision par watchdog systemd. */
  health(): Promise<AgentHealthResponse>;
}
