// AdminAuditController — audit global des transitions d'état (Phase 3, superadmin).
// Lit depuis deployment_state_transitions (INSERT-only, INV-04) — jamais de mutation.
// Export CSV direct en streaming sans charger tout en mémoire.

import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, count, sql, and, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Response } from 'express';
import {
  deploymentStateTransitions,
  deployments,
  projects,
  organizations,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';

@Controller('admin/audit')
@UseGuards(AdminGuard)
export class AdminAuditController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/audit — liste paginée des transitions d'état cross-tenant.
   * Filtres : orgId, deploymentId, from (ISO), to (ISO).
   * deployment_state_transitions est INSERT-only (INV-04) — lecture seule.
   */
  @Get()
  async listAudit(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('orgId') orgId?: string,
    @Query('deploymentId') deploymentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '50', 10) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (deploymentId) {
      conditions.push(eq(deploymentStateTransitions.deploymentId, deploymentId));
    }
    if (orgId) {
      conditions.push(eq(projects.orgId, orgId));
    }
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(deploymentStateTransitions.createdAt, fromDate));
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        conditions.push(lte(deploymentStateTransitions.createdAt, toDate));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(deploymentStateTransitions)
      .innerJoin(deployments, eq(deploymentStateTransitions.deploymentId, deployments.id))
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .where(whereClause);

    const rows = await this.db
      .select({
        id: deploymentStateTransitions.id,
        deploymentId: deploymentStateTransitions.deploymentId,
        fromState: deploymentStateTransitions.fromState,
        toState: deploymentStateTransitions.toState,
        reason: deploymentStateTransitions.reason,
        createdAt: deploymentStateTransitions.createdAt,
        projectName: projects.name,
        orgName: organizations.name,
        orgId: projects.orgId,
      })
      .from(deploymentStateTransitions)
      .innerJoin(deployments, eq(deploymentStateTransitions.deploymentId, deployments.id))
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      .where(whereClause)
      .orderBy(sql`${deploymentStateTransitions.createdAt} DESC`)
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
   * GET /admin/audit/export — export CSV complet des transitions d'état.
   * Colonnes : id, deploymentId, projectName, orgName, fromState, toState, message, createdAt.
   * Construit la string CSV et la retourne directement (sans pagination).
   */
  @Get('export')
  async exportAuditCsv(
    @Query('orgId') orgId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    if (!res) return;

    const conditions = [];

    if (orgId) {
      conditions.push(eq(projects.orgId, orgId));
    }
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(deploymentStateTransitions.createdAt, fromDate));
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        conditions.push(lte(deploymentStateTransitions.createdAt, toDate));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        id: deploymentStateTransitions.id,
        deploymentId: deploymentStateTransitions.deploymentId,
        fromState: deploymentStateTransitions.fromState,
        toState: deploymentStateTransitions.toState,
        reason: deploymentStateTransitions.reason,
        createdAt: deploymentStateTransitions.createdAt,
        projectName: projects.name,
        orgName: organizations.name,
      })
      .from(deploymentStateTransitions)
      .innerJoin(deployments, eq(deploymentStateTransitions.deploymentId, deployments.id))
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      .where(whereClause)
      .orderBy(sql`${deploymentStateTransitions.createdAt} ASC`);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit.csv"');

    // En-tête CSV
    res.write('id,deploymentId,projectName,orgName,fromState,toState,message,createdAt\n');

    // Lignes CSV — écriture ligne par ligne (pas de chargement en bloc)
    for (const row of rows) {
      const escapeCsv = (val: string | null | undefined): string => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const line = [
        escapeCsv(row.id),
        escapeCsv(row.deploymentId),
        escapeCsv(row.projectName),
        escapeCsv(row.orgName),
        escapeCsv(row.fromState ?? ''),
        escapeCsv(row.toState),
        escapeCsv(row.reason ?? ''),
        escapeCsv(row.createdAt?.toISOString() ?? ''),
      ].join(',');

      res.write(line + '\n');
    }

    res.end();
  }
}
