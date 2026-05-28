// AdminDeploymentsController — déploiements globaux cross-tenant (Phase 3, superadmin).
// Lectures directes sans withTenantTx — INV-06 respecté via AdminGuard (rôle lu en base).
// Tables d'audit INSERT-only — aucun UPDATE/DELETE (INV-04).

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, count, sql, and, ilike } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  deployments,
  deploymentLogs,
  projects,
  organizations,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';

@Controller('admin/deployments')
@UseGuards(AdminGuard)
export class AdminDeploymentsController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/deployments — liste paginée cross-tenant.
   * Filtres : status, orgId, search (nom de projet ILIKE).
   */
  @Get()
  async listDeployments(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('status') status?: string,
    @Query('orgId') orgId?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '20', 10) || 20));
    const offset = (page - 1) * limit;

    // Construction dynamique des conditions WHERE
    const conditions = [];

    if (status && ['pending', 'running', 'success', 'failed', 'rolled_back'].includes(status)) {
      conditions.push(
        eq(deployments.status, status as 'pending' | 'running' | 'success' | 'failed' | 'rolled_back'),
      );
    }
    if (orgId) {
      conditions.push(eq(projects.orgId, orgId));
    }
    if (search && search.trim().length > 0) {
      conditions.push(ilike(projects.name, `%${search.trim()}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .where(whereClause);

    const rows = await this.db
      .select({
        id: deployments.id,
        projectName: projects.name,
        orgId: projects.orgId,
        orgName: organizations.name,
        status: deployments.status,
        triggerType: deployments.triggerType,
        durationSeconds: deployments.durationSeconds,
        createdAt: deployments.createdAt,
        completedAt: deployments.completedAt,
      })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      .where(whereClause)
      .orderBy(sql`${deployments.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      total: Number(totalRow?.total ?? 0),
      page,
      limit,
    };
  }

  /**
   * GET /admin/deployments/:id/logs — logs d'un déploiement (cross-tenant).
   * deployment_logs est INSERT-only (INV-04) — lecture seule ici.
   */
  @Get(':id/logs')
  async getDeploymentLogs(@Param('id') id: string) {
    // Vérifier que le déploiement existe
    const [dep] = await this.db
      .select({ id: deployments.id })
      .from(deployments)
      .where(eq(deployments.id, id))
      .limit(1);

    if (!dep) {
      throw new NotFoundException(`Déploiement introuvable : ${id}`);
    }

    const logs = await this.db
      .select({
        id: deploymentLogs.id,
        step: deploymentLogs.step,
        level: deploymentLogs.level,
        message: deploymentLogs.message,
        payload: deploymentLogs.payload,
        createdAt: deploymentLogs.createdAt,
      })
      .from(deploymentLogs)
      .where(eq(deploymentLogs.deploymentId, id))
      .orderBy(sql`${deploymentLogs.createdAt} ASC`);

    return { deploymentId: id, logs };
  }
}
