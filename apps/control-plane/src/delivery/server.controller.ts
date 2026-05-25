import { Controller, Get, Post, Inject, Req, Param, NotFoundException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { servers, projects, deployments } from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import type { TenantRequest } from '../persistence/tenant-middleware';

@Controller('servers')
export class ServerController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /** GET /servers/:id */
  @Get(':id')
  async getServer(@Req() req: TenantRequest, @Param('id') serverId: string) {
    const [row] = await this.db
      .select({
        id: servers.id,
        name: servers.name,
        host: servers.host,
        port: servers.agentPort,
        status: servers.status,
        agentVersion: servers.agentVersion,
        lastSeenAt: servers.lastSeenAt,
        agentToken: servers.agentToken,
        orgId: servers.orgId,
      })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!row || row.orgId !== req.tenant.org_id) throw new NotFoundException('Serveur introuvable.');

    const deployedProjects = await this.db
      .select({ id: projects.id, name: projects.name, status: deployments.status })
      .from(projects)
      .leftJoin(
        deployments,
        eq(deployments.projectId, projects.id),
      )
      .where(eq(projects.serverId, serverId))
      .orderBy(desc(deployments.createdAt))
      .limit(20);

    // Keep only the most recent deployment per project
    const seen = new Set<string>();
    const latest = deployedProjects.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      status: toServerStatus(row.status),
      agentVersion: row.agentVersion ?? 'unknown',
      lastActivityAt: row.lastSeenAt?.toISOString() ?? null,
      tokenSuffix: row.agentToken.slice(-4),
      deployedProjects: latest.map((p) => ({
        id: p.id,
        name: p.name,
        status: (p.status ?? 'pending').toUpperCase(),
      })),
    };
  }

  /** POST /servers/:id/ping — vérifie la connectivité agent */
  @Post(':id/ping')
  async ping(@Req() req: TenantRequest, @Param('id') serverId: string) {
    const [row] = await this.db
      .select({ id: servers.id, orgId: servers.orgId })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!row || row.orgId !== req.tenant.org_id) throw new NotFoundException('Serveur introuvable.');

    // Placeholder — connexion réelle à l'agent dans P-agent
    return { latencyMs: null };
  }

  /** POST /servers/:id/regenerate-token */
  @Post(':id/regenerate-token')
  async regenerateToken(@Req() req: TenantRequest, @Param('id') serverId: string) {
    const [row] = await this.db
      .select({ id: servers.id, orgId: servers.orgId })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!row || row.orgId !== req.tenant.org_id) throw new NotFoundException('Serveur introuvable.');

    // Génération d'un nouveau token aléatoire
    const { randomBytes } = await import('crypto');
    const newToken = randomBytes(32).toString('hex');

    await this.db
      .update(servers)
      .set({ agentToken: newToken, updatedAt: new Date() })
      .where(eq(servers.id, serverId));

    return { token: newToken, suffix: newToken.slice(-4) };
  }
}

function toServerStatus(status: string): 'online' | 'offline' | 'unknown' {
  if (status === 'ready') return 'online';
  if (status === 'error' || status === 'destroyed') return 'offline';
  return 'unknown';
}
