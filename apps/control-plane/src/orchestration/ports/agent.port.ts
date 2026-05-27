import type { HealthCheck, PlanDeDeploiementNormalise } from '@gamad/contracts';

// C-06 / C-07 — Port vers l'agent VPS (INV-09).
// Toutes les opérations prennent les credentials du serveur cible au niveau de l'appel
// (host + agentPort + agentToken lus depuis servers en DB) — jamais depuis des env vars globaux.

export interface ServerEndpoint {
  host: string;
  agentPort: number;
  /** 🔑 Jamais loggé (CLAUDE.md §8). */
  agentToken: string;
}

export abstract class AgentPort {
  abstract dispatch(
    deploymentId: string,
    pdn: PlanDeDeploiementNormalise,
    server: ServerEndpoint,
  ): Promise<{ agentJobId: string }>;

  abstract rollback(
    deploymentId: string,
    snapshotRef: string,
    server: ServerEndpoint,
  ): Promise<void>;

  abstract checkHealth(
    deploymentId: string,
    checks: HealthCheck[],
    server: ServerEndpoint,
  ): Promise<{ passed: boolean; details: string[] }>;
}
