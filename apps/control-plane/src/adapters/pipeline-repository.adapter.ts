// Adaptateur Drizzle/Postgres de PipelineRepositoryPort (couche Adapters — INV-09).
// Toutes les écritures sont encapsulées dans withTenantTx (ADR-0005, INV-06).
// transitionWithLog : optimistic-lock (UPDATE WHERE status=from) → protège Race 2 (concurrence).
// pg_notify en fin de transaction → aucun état spéculatif au WebSocket (P-05 garde-fous).
// isStepDone/markStepDone : marqueur d'idempotence dans deployment_logs (INV-07).

import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { DeploymentState, PlanDeDeploiementNormalise, TenantContext } from '@gamad/contracts';
import {
  deployments,
  deploymentPlans,
  deploymentLogs,
  deploymentStateTransitions,
  servers,
  withTenantTx,
} from '@gamad/schema';
import { PipelineRepositoryPort } from '../orchestration/ports/pipeline-repository.port';

export const DB_TOKEN = 'DB_TOKEN';

const toDb = (s: DeploymentState) =>
  s.toLowerCase() as 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';

const toDomain = (s: string): DeploymentState => s.toUpperCase() as DeploymentState;

const IDEMPOTENCE_PREFIX = '__done:';

@Injectable()
export class PipelineRepositoryAdapter extends PipelineRepositoryPort {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) { super(); }

  // RLS sur deployments — OBLIGATOIREMENT dans withTenantTx (ADR-0005, INV-06).
  override async getDeploymentState(deploymentId: string, ctx: TenantContext): Promise<DeploymentState> {
    let status: string | undefined;
    await withTenantTx(this.db, ctx, async (tx) => {
      const [row] = await tx
        .select({ status: deployments.status })
        .from(deployments)
        .where(eq(deployments.id, deploymentId))
        .limit(1);
      status = row?.status;
    });
    if (!status) throw new Error(`Déploiement introuvable : ${deploymentId}`);
    return toDomain(status);
  }

  // RLS sur servers — OBLIGATOIREMENT dans withTenantTx (ADR-0005, INV-06).
  override async getServer(serverId: string, ctx: TenantContext): Promise<{ host: string; agentPort: number; agentToken: string }> {
    let result: { host: string; agentPort: number; agentToken: string } | undefined;
    await withTenantTx(this.db, ctx, async (tx) => {
      const [row] = await tx
        .select({ host: servers.host, agentPort: servers.agentPort, agentToken: servers.agentToken })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);
      result = row;
    });
    if (!result) throw new Error(`Serveur introuvable : ${serverId}`);
    return result;
  }

  override async getPlan(deploymentId: string): Promise<PlanDeDeploiementNormalise | null> {
    const [row] = await this.db
      .select({ plan: deploymentPlans.plan })
      .from(deploymentPlans)
      .where(eq(deploymentPlans.deploymentId, deploymentId))
      .limit(1);
    return row ? (row.plan as unknown as PlanDeDeploiementNormalise) : null;
  }

  override async isStepDone(deploymentId: string, step: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: deploymentLogs.id })
      .from(deploymentLogs)
      .where(
        and(
          eq(deploymentLogs.deploymentId, deploymentId),
          eq(deploymentLogs.step, IDEMPOTENCE_PREFIX + step),
        ),
      )
      .limit(1);
    return row != null;
  }

  override async transitionWithLog(
    deploymentId: string,
    from: DeploymentState,
    to: DeploymentState,
    log: { step: string; message: string },
    ctx: TenantContext,
  ): Promise<void> {
    await withTenantTx(this.db, ctx, async (tx) => {
      // Optimistic-lock : UPDATE n'affecte 0 ligne si un concurrent a déjà transitionné.
      // Protège Race 2 (double-FAILED simultané) sans constraint DB supplémentaire.
      const [updated] = await tx
        .update(deployments)
        .set({ status: toDb(to) })
        .where(and(eq(deployments.id, deploymentId), eq(deployments.status, toDb(from))))
        .returning({ id: deployments.id });

      if (!updated) return; // Race 2 : concurrent a déjà gagné, no-op.

      await tx.insert(deploymentStateTransitions).values({
        deploymentId,
        fromState: toDb(from),
        toState: toDb(to),
        reason: log.message,
      });

      await tx.insert(deploymentLogs).values({
        deploymentId,
        step: log.step,
        level: 'info',
        message: log.message,
      });

      // NOTIFY après les INSERTs — feu uniquement au COMMIT (aucun état spéculatif).
      await tx.execute(
        sql`SELECT pg_notify('deployment_transitions', ${JSON.stringify({ deploymentId, toState: to })})`,
      );
    });
  }

  override async logStep(
    deploymentId: string,
    entry: { step: string; message: string; level: 'info' | 'error' },
    ctx: TenantContext,
  ): Promise<void> {
    await withTenantTx(this.db, ctx, async (tx) => {
      await tx.insert(deploymentLogs).values({
        deploymentId,
        step: entry.step,
        level: entry.level,
        message: entry.message,
      });
    });
  }

  override async savePlan(
    deploymentId: string,
    pdn: PlanDeDeploiementNormalise,
    ctx: TenantContext,
  ): Promise<void> {
    const planHash = createHash('sha256').update(JSON.stringify(pdn)).digest('hex');

    await withTenantTx(this.db, ctx, async (tx) => {
      await tx.insert(deploymentPlans).values({
        deploymentId,
        pdnVersion: pdn.pdn_version,
        planHash,
        sourceType: pdn.source.type,
        sourceUrl: pdn.source.url,
        sourceRef: pdn.source.ref.value,
        sourceFingerprint: pdn.source.fingerprint as Record<string, unknown>,
        plan: pdn as unknown as Record<string, unknown>,
      });
    });
  }

  override async markStepDone(
    deploymentId: string,
    step: string,
    ctx: TenantContext,
  ): Promise<void> {
    await withTenantTx(this.db, ctx, async (tx) => {
      await tx.insert(deploymentLogs).values({
        deploymentId,
        step: IDEMPOTENCE_PREFIX + step,
        level: 'info',
        message: 'step-completed',
      });
    });
  }
}
