import type { DeploymentState, PlanDeDeploiementNormalise, TenantContext } from '@gamad/contracts';

// Port de persistance du pipeline (C-11 + INV-04).
// Toutes les écritures sont INSERT-only sur les tables d'audit (P-01).
// transitionWithLog() : atomique — un seul withTenantTx enveloppe les deux INSERTs
// (state_transitions + deployment_logs). Les deux sont indissociables pour l'audit.

export abstract class PipelineRepositoryPort {
  /** État courant du déploiement — exige le contexte tenant (RLS sur deployments). */
  abstract getDeploymentState(deploymentId: string, ctx: TenantContext): Promise<DeploymentState>;

  /** Credentials du serveur VPS pour dispatcher l'agent — exige le contexte tenant (RLS sur servers). */
  abstract getServer(serverId: string, ctx: TenantContext): Promise<{ host: string; agentPort: number; agentToken: string }>;

  /** PDN persisté (null si resolve-source n'a pas encore tourné). */
  abstract getPlan(deploymentId: string): Promise<PlanDeDeploiementNormalise | null>;

  /** Vrai si le job a déjà été complété (marqueur d'idempotence INV-07). */
  abstract isStepDone(deploymentId: string, step: string): Promise<boolean>;

  /**
   * Atomic : INSERT deployment_state_transitions + INSERT deployment_logs
   * dans le même withTenantTx. Garantie d'audit C-11 : "l'état est X" et
   * "voici pourquoi" ne peuvent pas être séparés par un crash.
   */
  abstract transitionWithLog(
    deploymentId: string,
    from: DeploymentState,
    to: DeploymentState,
    log: { step: string; message: string },
    ctx: TenantContext,
  ): Promise<void>;

  /** INSERT deployment_logs (étapes intermédiaires sans changement d'état). */
  abstract logStep(
    deploymentId: string,
    entry: { step: string; message: string; level: 'info' | 'error' },
    ctx: TenantContext,
  ): Promise<void>;

  /** INSERT deployment_plans — PDN résolu. */
  abstract savePlan(
    deploymentId: string,
    pdn: PlanDeDeploiementNormalise,
    ctx: TenantContext,
  ): Promise<void>;

  /** Marque l'étape comme terminée (marqueur d'idempotence). */
  abstract markStepDone(
    deploymentId: string,
    step: string,
    ctx: TenantContext,
  ): Promise<void>;
}
