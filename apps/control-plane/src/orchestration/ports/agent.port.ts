import type { HealthCheck, PlanDeDeploiementNormalise } from '@gamad/contracts';

// C-06 / C-07 — Port vers l'agent VPS (INV-09).
// Implémenté en P-04. Ici : stub injectable pour P-03.
// dispatch() → commande de déploiement (PDN complet).
// rollback() → restauration du snapshot pré-déploiement (INV-08).
// checkHealth() → vérification des health checks C-01 depuis l'intérieur du VPS.

export abstract class AgentPort {
  abstract dispatch(
    deploymentId: string,
    pdn: PlanDeDeploiementNormalise,
  ): Promise<{ agentJobId: string }>;

  abstract rollback(deploymentId: string, snapshotRef: string): Promise<void>;

  abstract checkHealth(
    deploymentId: string,
    checks: HealthCheck[],
  ): Promise<{ passed: boolean; details: string[] }>;
}
