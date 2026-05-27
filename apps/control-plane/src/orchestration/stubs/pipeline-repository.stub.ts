// Stub injectable de PipelineRepositoryPort — usage : tests P-03.
// En mémoire ; pas de PostgreSQL ni de withTenantTx nécessaire.
// Expose les enregistrements pour assertions : transitions, logs, steps complétés.

import { Injectable } from '@nestjs/common';
import type { DeploymentState, PlanDeDeploiementNormalise, TenantContext } from '@gamad/contracts';
import { PipelineRepositoryPort } from '../ports/pipeline-repository.port';

export interface RecordedTransition {
  deploymentId: string;
  from: DeploymentState;
  to: DeploymentState;
  step: string;
  message: string;
}

export interface RecordedLog {
  deploymentId: string;
  step: string;
  message: string;
  level: 'info' | 'error';
}

@Injectable()
export class PipelineRepositoryStub extends PipelineRepositoryPort {
  private readonly states = new Map<string, DeploymentState>();
  private readonly plans = new Map<string, PlanDeDeploiementNormalise>();
  private readonly doneSteps = new Map<string, Set<string>>();
  private readonly serverMap = new Map<string, { host: string; agentPort: number; agentToken: string }>();

  readonly transitions: RecordedTransition[] = [];
  readonly logs: RecordedLog[] = [];

  // ── Setup helpers ──────────────────────────────────────────────────────────

  seed(deploymentId: string, state: DeploymentState): this {
    this.states.set(deploymentId, state);
    return this;
  }

  seedPlan(deploymentId: string, pdn: PlanDeDeploiementNormalise): this {
    this.plans.set(deploymentId, pdn);
    return this;
  }

  seedServer(serverId: string, server: { host: string; agentPort: number; agentToken: string }): this {
    this.serverMap.set(serverId, server);
    return this;
  }

  // ── PipelineRepositoryPort ─────────────────────────────────────────────────

  override async getDeploymentState(deploymentId: string, _ctx: TenantContext): Promise<DeploymentState> {
    const state = this.states.get(deploymentId);
    if (!state) throw new Error(`PipelineRepositoryStub : deploymentId inconnu : ${deploymentId}`);
    return state;
  }

  override async getServer(serverId: string, _ctx: TenantContext): Promise<{ host: string; agentPort: number; agentToken: string }> {
    const server = this.serverMap.get(serverId);
    if (!server) return { host: 'stub-host', agentPort: 7500, agentToken: 'stub-token' };
    return server;
  }

  override async getPlan(deploymentId: string): Promise<PlanDeDeploiementNormalise | null> {
    return this.plans.get(deploymentId) ?? null;
  }

  override async isStepDone(deploymentId: string, step: string): Promise<boolean> {
    return this.doneSteps.get(deploymentId)?.has(step) ?? false;
  }

  override async transitionWithLog(
    deploymentId: string,
    from: DeploymentState,
    to: DeploymentState,
    log: { step: string; message: string },
    _ctx: TenantContext,
  ): Promise<void> {
    // Atomique en mémoire : les deux enregistrements ou aucun.
    this.states.set(deploymentId, to);
    this.transitions.push({ deploymentId, from, to, step: log.step, message: log.message });
    this.logs.push({ deploymentId, step: log.step, message: log.message, level: 'error' });
  }

  override async logStep(
    deploymentId: string,
    entry: { step: string; message: string; level: 'info' | 'error' },
    _ctx: TenantContext,
  ): Promise<void> {
    this.logs.push({ deploymentId, step: entry.step, message: entry.message, level: entry.level });
  }

  override async savePlan(
    deploymentId: string,
    pdn: PlanDeDeploiementNormalise,
    _ctx: TenantContext,
  ): Promise<void> {
    this.plans.set(deploymentId, pdn);
  }

  override async markStepDone(
    deploymentId: string,
    step: string,
    _ctx: TenantContext,
  ): Promise<void> {
    if (!this.doneSteps.has(deploymentId)) {
      this.doneSteps.set(deploymentId, new Set());
    }
    this.doneSteps.get(deploymentId)!.add(step);
  }
}
