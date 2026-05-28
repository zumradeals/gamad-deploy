// AdminServersController — agents & serveurs cross-tenant (Phase 3, superadmin).
// Lectures directes sans withTenantTx — INV-06 respecté via AdminGuard (rôle lu en base).
// isStale calculé côté serveur : lastSeenAt null ou > 15 minutes.

import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { count, sql, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  servers,
  organizations,
  projects,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';

const STALE_THRESHOLD_MINUTES = 15;

@Controller('admin/servers')
@UseGuards(AdminGuard)
export class AdminServersController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/servers — liste complète des serveurs cross-tenant (sans pagination).
   * isStale = lastSeenAt null ou plus vieux que 15 minutes.
   * projectsCount = nombre de projets associés au serveur.
   */
  @Get()
  async listServers() {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    // Nombre de projets par serveur
    const projectCountsRows = await this.db
      .select({
        serverId: projects.serverId,
        nb: count(),
      })
      .from(projects)
      .groupBy(projects.serverId);

    const projectCountMap = new Map<string, number>();
    for (const row of projectCountsRows) {
      if (row.serverId) {
        projectCountMap.set(row.serverId, Number(row.nb));
      }
    }

    const rows = await this.db
      .select({
        id: servers.id,
        name: servers.name,
        host: servers.host,
        agentPort: servers.agentPort,
        status: servers.status,
        agentVersion: servers.agentVersion,
        lastSeenAt: servers.lastSeenAt,
        orgId: servers.orgId,
        orgName: organizations.name,
      })
      .from(servers)
      .innerJoin(organizations, eq(servers.orgId, organizations.id))
      .orderBy(sql`${servers.createdAt} DESC`);

    const data = rows.map((row) => ({
      ...row,
      isStale:
        row.lastSeenAt === null ||
        new Date(row.lastSeenAt).getTime() < staleThreshold.getTime(),
      projectsCount: projectCountMap.get(row.id) ?? 0,
    }));

    return { data };
  }
}
