// Service transversal partagé par les 5 processors.
// Encapsule les trois responsabilités cross-cutting :
//   1. Idempotence (INV-07) : isStepDone → return early si déjà complété.
//   2. Transitions d'état via la StateMachine du Domain (pas de règle métier ici).
//   3. Chemin d'échec (INV-08) : RUNNING → FAILED + rollback si on_error_stop.
// Le binôme transition+log (C-11) reste atomique via transitionWithLog().

import { Injectable, Inject } from '@nestjs/common';
import type { DeploymentState, PlanDeDeploiementNormalise, TenantContext } from '@gamad/contracts';
import { StateMachineService } from '../../domain/index';
import { AgentPort } from '../ports/agent.port';
import { PipelineRepositoryPort } from '../ports/pipeline-repository.port';
import type { PipelineJobData } from '../pipeline/pipeline.types';

export interface RunContext {
  readonly pdn: PlanDeDeploiementNormalise | null;
  readonly tenantCtx: TenantContext;
  /** Valide via StateMachine (Domain) puis persiste transition+log de façon atomique. */
  transition(from: DeploymentState, to: DeploymentState, message: string): Promise<void>;
  /** Insère un log sans changer l'état. */
  log(message: string, level?: 'info' | 'error'): Promise<void>;
}

@Injectable()
export class PipelineJobRunner {
  private readonly stateMachine = new StateMachineService();

  constructor(
    @Inject(PipelineRepositoryPort) readonly repo: PipelineRepositoryPort,
    @Inject(AgentPort) readonly agentPort: AgentPort,
  ) {}

  async run(
    jobName: string,
    jobData: PipelineJobData,
    action: (ctx: RunContext) => Promise<void>,
  ): Promise<void> {
    const tenantCtx: TenantContext = { org_id: jobData.orgId, user_id: jobData.userId };

    // INV-07 : si le step est déjà complété (replay BullMQ ou re-run manuel), no-op.
    if (await this.repo.isStepDone(jobData.deploymentId, jobName)) return;

    const ctx = this.buildRunContext(jobName, jobData.deploymentId, tenantCtx);

    try {
      await action(ctx);
      // Marqueur d'idempotence : INSERT après que l'action a réussi.
      await this.repo.markStepDone(jobData.deploymentId, jobName, tenantCtx);
    } catch (error) {
      await this.handleFailure(jobName, jobData.deploymentId, tenantCtx, error, jobData.serverId);
    }
  }

  private buildRunContext(
    jobName: string,
    deploymentId: string,
    tenantCtx: TenantContext,
  ): RunContext {
    // Capture references — évite l'alias `self = this` (no-this-alias).
    const repo = this.repo;
    const stateMachine = this.stateMachine;
    return {
      get pdn(): PlanDeDeploiementNormalise | null {
        // Retourne null ici ; les processors qui en ont besoin appellent repo.getPlan() directement.
        return null;
      },
      tenantCtx,
      async transition(from, to, message) {
        // Domain valide la légalité AVANT d'écrire (lève IllegalTransitionError si illégale).
        const validated = stateMachine.transition(from, to);
        await repo.transitionWithLog(deploymentId, from, validated, { step: jobName, message }, tenantCtx);
      },
      async log(message, level = 'info') {
        await repo.logStep(deploymentId, { step: jobName, message, level }, tenantCtx);
      },
    };
  }

  private async handleFailure(
    jobName: string,
    deploymentId: string,
    ctx: TenantContext,
    error: unknown,
    serverId?: string,
  ): Promise<void> {
    const currentState = await this.repo.getDeploymentState(deploymentId, ctx);

    // Transition (PENDING|RUNNING) → FAILED via Domain (valide la légalité, ADR-0012).
    // Si l'état est déjà FAILED ou terminal (retry après handleFailure partiel), on ne retente pas.
    if (currentState === 'RUNNING' || currentState === 'PENDING') {
      const validated = this.stateMachine.transition(currentState, 'FAILED');
      const message = error instanceof Error ? error.message : String(error);
      // Atomique : transition + log d'erreur dans le même withTenantTx (C-11).
      await this.repo.transitionWithLog(
        deploymentId, currentState, validated,
        { step: jobName, message },
        ctx,
      );
    }

    // INV-08 : on_error_stop → rollback si le PDN le prescrit.
    // Le rollback peut échouer si l'agent est injoignable ; on absorbe l'erreur
    // car le déploiement est déjà FAILED — un re-throw provoquerait des retries infinis.
    const pdn = await this.repo.getPlan(deploymentId);
    if (pdn?.policies.on_error_stop && serverId) {
      const server = await this.repo.getServer(serverId, ctx);
      try {
        await this.agentPort.rollback(
          deploymentId,
          pdn.source.fingerprint.commit_sha ?? '',
          server,
        );
      } catch {
        // Rollback best-effort : l'échec est ignoré, le statut FAILED est déjà persisté.
      }
    }
    // Ne pas re-throw : le job est considéré terminé (état FAILED enregistré).
    // Si handleFailure lui-même échoue (ex: DB injoignable), l'exception se propage → BullMQ retente.
  }
}
