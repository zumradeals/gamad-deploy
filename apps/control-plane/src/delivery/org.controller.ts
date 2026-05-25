import { Controller, Get, Post, Body, Inject, Req, Query, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, organizations, organizationMembers, servers, projects, deployments } from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import type { TenantRequest } from '../persistence/tenant-middleware';

@Controller('orgs')
export class OrgController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /** GET /orgs/:id/settings */
  @Get(':id/settings')
  async getSettings(@Req() req: TenantRequest) {
    const [org] = await this.db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, req.tenant.org_id))
      .limit(1);

    if (!org) throw new NotFoundException('Organisation introuvable.');

    return { id: org.id, name: org.name, slug: org.slug, plan: 'free' };
  }

  /** GET /orgs/:id/notifications — defaults (no persistence table yet) */
  @Get(':id/notifications')
  getNotifications() {
    return {
      deploySuccess: true,
      deployFailed: true,
      rollback: true,
      renewalUpcoming: false,
      webhookUrl: '',
    };
  }

  /** GET /orgs/:id/stats */
  @Get(':id/stats')
  async getStats(@Req() req: TenantRequest) {
    const orgId = req.tenant.org_id;

    const [projectRow] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    const [serverRow] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(servers)
      .where(and(eq(servers.orgId, orgId), eq(servers.status, 'ready')));

    const [deplRow] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .where(and(eq(projects.orgId, orgId), eq(deployments.status, 'running')));

    return {
      activeProjects: Number(projectRow?.count ?? 0),
      onlineServers: Number(serverRow?.count ?? 0),
      runningDeployments: Number(deplRow?.count ?? 0),
    };
  }

  /** GET /orgs/:id/audit-events — no audit table yet, returns empty list */
  @Get(':id/audit-events')
  getAuditEvents() {
    return [];
  }

  /** GET /orgs/:id/projects */
  @Get(':id/projects')
  async getProjects(@Req() req: TenantRequest) {
    const rows = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        repoUrl: projects.repoUrl,
        branch: projects.repoBranch,
        serverId: projects.serverId,
        serverName: servers.name,
        lastDeployedAt: projects.lastDeployedAt,
      })
      .from(projects)
      .leftJoin(servers, eq(projects.serverId, servers.id))
      .where(eq(projects.orgId, req.tenant.org_id))
      .orderBy(desc(projects.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      repoUrl: r.repoUrl,
      branch: r.branch,
      serverId: r.serverId ?? '',
      serverName: r.serverName ?? '',
      lastDeploymentId: null,
      lastDeploymentStatus: null,
      lastDeploymentAt: r.lastDeployedAt?.toISOString() ?? null,
    }));
  }

  /** GET /orgs/:id/deployments?limit=N */
  @Get(':id/deployments')
  async getDeployments(@Req() req: TenantRequest, @Query('limit') limitStr?: string) {
    const limit = Math.min(parseInt(limitStr ?? '10', 10) || 10, 50);

    const rows = await this.db
      .select({
        id: deployments.id,
        projectId: deployments.projectId,
        projectName: projects.name,
        status: deployments.status,
        branch: projects.repoBranch,
        createdAt: deployments.createdAt,
        completedAt: deployments.completedAt,
      })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .where(eq(projects.orgId, req.tenant.org_id))
      .orderBy(desc(deployments.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName,
      status: r.status.toUpperCase(),
      branch: r.branch,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    }));
  }

  /** GET /orgs — liste des orgs dont l'utilisateur est membre */
  @Get()
  async listOrgs(@Req() req: TenantRequest) {
    const rows = await this.db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.orgId, organizations.id))
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.userId, req.tenant.user_id));

    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, plan: 'free' }));
  }

  /** GET /orgs/:id/servers */
  @Get(':id/servers')
  async listServers(@Req() req: TenantRequest) {
    const rows = await this.db
      .select({
        id: servers.id,
        name: servers.name,
        host: servers.host,
        port: servers.agentPort,
        status: servers.status,
      })
      .from(servers)
      .where(eq(servers.orgId, req.tenant.org_id))
      .orderBy(desc(servers.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      host: r.host,
      port: r.port,
      status: toServerStatus(r.status),
    }));
  }

  /** POST /orgs/:id/servers */
  @Post(':id/servers')
  async createServer(@Req() req: TenantRequest, @Body() body: CreateServerDto) {
    const existing = await this.db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.agentToken, body.agentToken))
      .limit(1);

    if (existing.length > 0) throw new ConflictException('Ce token agent est déjà utilisé par un autre serveur.');

    const inserted = await this.db
      .insert(servers)
      .values({
        orgId: req.tenant.org_id,
        name: body.name,
        host: body.host,
        agentPort: body.port,
        agentToken: body.agentToken,
        status: 'provisioning',
      })
      .returning({ id: servers.id, name: servers.name, host: servers.host, port: servers.agentPort, status: servers.status });

    const row = inserted[0];
    if (!row) throw new Error('Échec de la création du serveur.');

    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      status: toServerStatus(row.status),
    };
  }
}

class CreateServerDto {
  name!: string;
  host!: string;
  port!: number;
  agentToken!: string;
}

function toServerStatus(status: string): 'online' | 'offline' | 'unknown' {
  if (status === 'ready') return 'online';
  if (status === 'error' || status === 'destroyed') return 'offline';
  return 'unknown';
}
