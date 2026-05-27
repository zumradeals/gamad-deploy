import { Controller, Get, Post, Body, Inject, Req, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, organizations, organizationMembers, servers, projects, deployments } from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import type { TenantRequest } from '../persistence/tenant-middleware';
import type { RepoAnalysis } from '@gamad/contracts';
import { SourceInferer } from '../domain/source-resolver/source-inferer';

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
        lastDeploymentId: sql<string | null>`(
          SELECT id FROM deployments
          WHERE project_id = ${projects.id}
          ORDER BY created_at DESC
          LIMIT 1
        )`,
        lastDeploymentStatus: sql<string | null>`(
          SELECT status FROM deployments
          WHERE project_id = ${projects.id}
          ORDER BY created_at DESC
          LIMIT 1
        )`,
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
      lastDeploymentId: r.lastDeploymentId ?? null,
      lastDeploymentStatus: r.lastDeploymentStatus?.toUpperCase() ?? null,
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

  /** POST /orgs/:id/projects/analyze — analyse un repo via l'API GitHub */
  @Post(':id/projects/analyze')
  async analyzeRepo(@Req() req: TenantRequest, @Body() body: AnalyzeRepoDto) {
    if (req.tenant.org_id !== body.orgId && body.orgId !== undefined) {
      throw new BadRequestException('org_id invalide.');
    }

    const githubMatch = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(body.repoUrl.replace(/\.git$/, ''));

    if (!githubMatch) {
      return {
        confidence: 'low',
        stack: 'Inconnu',
        ports: [3000],
        healthCheckPath: '/health',
        assumptions: ["URL non-GitHub : analyse automatique limitée aux dépôts GitHub."],
        hasCompose: false,
        hasDockerfile: false,
        hasGamadJson: false,
        detectedFramework: '',
      };
    }

    const [, owner, repo] = githubMatch;
    const branch = body.branch;
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
    if (body.gitToken) headers['Authorization'] = `token ${body.gitToken}`;

    let rootFiles: string[] = [];
    try {
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!treeRes.ok) {
        throw new BadRequestException(
          `Dépôt inaccessible (HTTP ${treeRes.status}). Vérifiez l'URL, la branche et le token.`,
        );
      }
      const treeData = (await treeRes.json()) as { tree: Array<{ path: string; type: string }> };
      rootFiles = treeData.tree
        .filter((f) => f.type === 'blob' && !f.path.includes('/'))
        .map((f) => f.path);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[analyzeRepo] fetch GitHub failed: ${reason}`);
      throw new BadRequestException(`Impossible de contacter l'API GitHub (${reason}). Vérifiez la connectivité.`);
    }

    let detectedFramework = '';
    if (rootFiles.includes('package.json')) {
      try {
        const pkgRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
          { headers, signal: AbortSignal.timeout(5_000) },
        );
        if (pkgRes.ok) {
          const pkgContent = (await pkgRes.json()) as { content: string };
          const pkg = JSON.parse(Buffer.from(pkgContent.content, 'base64').toString()) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          const allDeps = [
            ...Object.keys(pkg.dependencies ?? {}),
            ...Object.keys(pkg.devDependencies ?? {}),
          ];
          if (allDeps.includes('next')) detectedFramework = 'next';
          else if (allDeps.some((d) => d === 'vite' || d === '@vitejs/plugin-react')) detectedFramework = 'vite';
          else if (allDeps.includes('express')) detectedFramework = 'express';
          else if (allDeps.includes('fastify')) detectedFramework = 'fastify';
          else if (allDeps.includes('@nestjs/core')) detectedFramework = 'nest';
          else if (allDeps.includes('koa')) detectedFramework = 'koa';
          else if (allDeps.includes('react')) detectedFramework = 'react';
          else detectedFramework = 'node';
        }
      } catch { /* package.json optionnel */ }
    }

    let rawContract: string | undefined;
    const hasGamadJson = rootFiles.includes('gamad.json');
    if (hasGamadJson) {
      try {
        const gamadRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/gamad.json`,
          { headers, signal: AbortSignal.timeout(5_000) },
        );
        if (gamadRes.ok) {
          const gamadContent = (await gamadRes.json()) as { content: string };
          rawContract = Buffer.from(gamadContent.content, 'base64').toString();
        }
      } catch { /* gamad.json optionnel */ }
    }

    const hasCompose = rootFiles.some((f) => f === 'docker-compose.yml' || f === 'docker-compose.yaml');
    const hasDockerfile = rootFiles.some((f) => f.toLowerCase() === 'dockerfile');

    const repoAnalysis: RepoAnalysis = {
      repo_url: body.repoUrl,
      ref: { type: 'branch', value: branch },
      has_dockerfile: hasDockerfile,
      has_compose_file: hasCompose,
      has_gamad_json: hasGamadJson,
      detected_files: rootFiles,
      detected_framework: detectedFramework,
      detected_runtime: detectedFramework ? 'node' : '',
      ...(rawContract !== undefined ? { rawContract } : {}),
    };

    const inferer = new SourceInferer();
    const { pdn, confidence, assumptions } = inferer.infer(repoAnalysis);

    const confidenceLevel: 'high' | 'medium' | 'low' =
      confidence >= 0.75 ? 'high' : confidence >= 0.50 ? 'medium' : 'low';

    const port = pdn.runtime.ports['http'] ?? 3000;
    const healthUrl = pdn.health_checks[0]?.url ?? `http://localhost:${port}/health`;
    let healthCheckPath = '/health';
    try { healthCheckPath = new URL(healthUrl).pathname; } catch { /* URL non-absolue → fallback /health */ }
    const stack = buildStackLabel(detectedFramework, pdn.artifact.kind);

    return {
      confidence: confidenceLevel,
      stack,
      ports: [port],
      healthCheckPath,
      assumptions,
      hasCompose,
      hasDockerfile,
      hasGamadJson,
      detectedFramework,
    };
  }

  /** POST /orgs/:id/servers */
  @Post(':id/servers')
  async createServer(@Req() req: TenantRequest, @Body() body: CreateServerDto) {
    const { randomBytes } = await import('crypto');
    const agentToken = randomBytes(32).toString('hex');

    const inserted = await this.db
      .insert(servers)
      .values({
        orgId: req.tenant.org_id,
        name: body.name,
        host: body.host,
        agentPort: body.port,
        agentToken,
        status: 'provisioning',
      })
      .returning({ id: servers.id, name: servers.name, host: servers.host, port: servers.agentPort, status: servers.status });

    const row = inserted[0];
    if (!row) throw new Error('Échec de la création du serveur.');

    // Le token complet est retourné une seule fois à la création.
    // Après, seuls les 4 derniers caractères (tokenSuffix) sont exposés (CLAUDE.md §8).
    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      status: toServerStatus(row.status),
      token: agentToken,
    };
  }
}

class CreateServerDto {
  name!: string;
  host!: string;
  port!: number;
}

class AnalyzeRepoDto {
  orgId?: string;
  repoUrl!: string;
  branch!: string;
  gitToken?: string;
}

function toServerStatus(status: string): 'online' | 'offline' | 'unknown' {
  if (status === 'ready') return 'online';
  if (status === 'error' || status === 'destroyed') return 'offline';
  return 'unknown';
}

function buildStackLabel(framework: string, kind: string): string {
  if (kind === 'docker-compose') return 'Docker Compose';
  const map: Record<string, string> = {
    next: 'Next.js', vite: 'Vite (SPA)', react: 'React (CRA)',
    express: 'Express.js', fastify: 'Fastify', nest: 'NestJS', koa: 'Koa',
  };
  return map[framework] ?? (kind === 'node' ? 'Node.js' : 'Site statique');
}
