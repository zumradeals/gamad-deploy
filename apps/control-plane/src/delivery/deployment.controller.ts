// C-12 — REST API : création et consultation de déploiements.
// POST /deployments accepte le payload complet du wizard (repoUrl, branch, serverId, …).
// GET  /deployments/:id retourne le détail + étapes pipeline (DeploymentDetail).
// GET  /deployments/:id/logs retourne les logs d'audit (LogLine[]).
// Le tenant est injecté par TenantMiddleware — jamais fourni par le client (INV-06).
// git_token : jamais loggé, jamais persisté en clair (CLAUDE.md §8).

import { Controller, Post, Get, Body, Req, Param } from '@nestjs/common';
import { Inject, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { eq, and, asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { deployments, deploymentLogs, projects, servers, withTenantTx } from '@gamad/schema';
import type { TenantRequest } from '../persistence/tenant-middleware';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import {
  PIPELINE_QUEUE_TOKEN,
  JobName,
  DEFAULT_JOB_OPTIONS,
} from '../orchestration/pipeline/pipeline.constants';
import type { PipelineJobData } from '../orchestration/pipeline/pipeline.types';

const PIPELINE_STEPS = [
  JobName.RESOLVE_SOURCE,
  JobName.PROVISION_DB,
  JobName.DISPATCH_AGENT,
  JobName.AWAIT_HEALTH,
] as const;
type StepName = (typeof PIPELINE_STEPS)[number];

type StepStatus = 'pending' | 'running' | 'done' | 'failed';

interface DeploymentStep {
  name: StepName;
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

@Controller('deployments')
export class DeploymentController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: NodePgDatabase,
    @Inject(PIPELINE_QUEUE_TOKEN) private readonly queue: Queue,
  ) {}

  /** GET /deployments/:id — détail déploiement + étapes */
  @Get(':id')
  async getDetail(@Req() req: TenantRequest, @Param('id') id: string) {
    const [row] = await this.db
      .select({
        id: deployments.id,
        projectId: deployments.projectId,
        projectName: projects.name,
        status: deployments.status,
        branch: projects.repoBranch,
        domain: projects.domain,
        serverName: servers.name,
        createdAt: deployments.createdAt,
        completedAt: deployments.completedAt,
      })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .leftJoin(servers, eq(projects.serverId, servers.id))
      .where(and(eq(deployments.id, id), eq(projects.orgId, req.tenant.org_id)))
      .limit(1);

    if (!row) throw new NotFoundException();

    // Logs par étape pour dériver le statut de chaque étape du pipeline
    const logRows = await this.db
      .select({ step: deploymentLogs.step, level: deploymentLogs.level, createdAt: deploymentLogs.createdAt })
      .from(deploymentLogs)
      .where(and(
        eq(deploymentLogs.deploymentId, id),
        sql`${deploymentLogs.step} NOT LIKE '__done:%'`,
      ))
      .orderBy(asc(deploymentLogs.createdAt));

    const steps = buildSteps(logRows, row.status);

    return {
      id: row.id,
      projectId: row.projectId,
      projectName: row.projectName,
      status: row.status.toUpperCase(),
      branch: row.branch,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      serverName: row.serverName ?? '',
      domain: row.domain ?? null,
      steps,
    };
  }

  /** GET /deployments/:id/logs — logs d'audit pour le terminal */
  @Get(':id/logs')
  async getLogs(@Req() req: TenantRequest, @Param('id') id: string) {
    // Vérifie l'appartenance au tenant avant d'exposer les logs
    const [dep] = await this.db
      .select({ id: deployments.id })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .where(and(eq(deployments.id, id), eq(projects.orgId, req.tenant.org_id)))
      .limit(1);

    if (!dep) throw new NotFoundException();

    const rows = await this.db
      .select({ level: deploymentLogs.level, message: deploymentLogs.message, createdAt: deploymentLogs.createdAt })
      .from(deploymentLogs)
      .where(and(
        eq(deploymentLogs.deploymentId, id),
        sql`${deploymentLogs.step} NOT LIKE '__done:%'`,
      ))
      .orderBy(asc(deploymentLogs.createdAt))
      .limit(1000);

    return rows.map((r) => ({
      level: r.level as 'info' | 'warn' | 'error' | 'success',
      message: r.message,
      timestamp: r.createdAt.toISOString(),
    }));
  }

  /** POST /deployments — création depuis le wizard */
  @Post()
  async launch(
    @Body() body: WizardDeploymentDto,
    @Req() req: TenantRequest,
  ): Promise<{ id: string }> {
    const ctx = req.tenant;

    // Dérive le nom du projet depuis l'URL du dépôt (dernier segment sans .git)
    const projectName =
      body.repoUrl
        .replace(/\.git$/, '')
        .split('/')
        .filter(Boolean)
        .pop() ?? 'projet';

    // Upsert du projet : réutilise un projet existant pour le même repo/branche/serveur
    let projectId: string;
    const [existing] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.orgId, ctx.org_id),
          eq(projects.repoUrl, body.repoUrl),
          eq(projects.repoBranch, body.branch),
          eq(projects.serverId, body.serverId),
        ),
      )
      .limit(1);

    if (existing) {
      projectId = existing.id;
      await this.db
        .update(projects)
        .set({ domain: body.domain ?? null, enableHttps: body.httpsEnabled, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    } else {
      const [inserted] = await this.db
        .insert(projects)
        .values({
          orgId: ctx.org_id,
          serverId: body.serverId,
          name: projectName,
          repoUrl: body.repoUrl,
          repoBranch: body.branch,
          domain: body.domain ?? null,
          enableHttps: body.httpsEnabled,
        })
        .returning({ id: projects.id });
      projectId = inserted!.id;
    }

    // INSERT deployment (PENDING)
    let deploymentId!: string;
    await withTenantTx(this.db, ctx, async (tx) => {
      const [dep] = await tx
        .insert(deployments)
        .values({
          projectId,
          triggerType: 'manual',
          triggerUserId: ctx.user_id,
          status: 'pending',
          commitSha: null,
        })
        .returning({ id: deployments.id });
      deploymentId = dep!.id;
    });

    // Enqueue resolve-source — git_token jamais loggé ni persisté (CLAUDE.md §8)
    const jobData: PipelineJobData = {
      deploymentId,
      orgId: ctx.org_id,
      userId: ctx.user_id,
      serverId: body.serverId,
      repoAnalysis: {
        repo_url: body.repoUrl,
        ref: { type: 'branch' as const, value: body.branch },
        has_dockerfile: body.hasDockerfile,
        has_compose_file: body.hasCompose,
        has_gamad_json: body.hasGamadJson,
        detected_framework: body.detectedFramework,
        detected_runtime: body.detectedFramework ? 'node' : '',
      },
      ...(body.gitToken ? { gitToken: body.gitToken } : {}),
    };

    await this.queue.add(JobName.RESOLVE_SOURCE, jobData, DEFAULT_JOB_OPTIONS);

    return { id: deploymentId };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSteps(
  logs: Array<{ step: string | null; level: string; createdAt: Date }>,
  dbStatus: string,
): DeploymentStep[] {
  const stepMap = new Map<string, { firstAt: Date; lastAt: Date; hasError: boolean }>();
  for (const log of logs) {
    if (!log.step) continue;
    const existing = stepMap.get(log.step);
    if (existing) {
      if (log.createdAt > existing.lastAt) existing.lastAt = log.createdAt;
      if (log.level === 'error') existing.hasError = true;
    } else {
      stepMap.set(log.step, { firstAt: log.createdAt, lastAt: log.createdAt, hasError: log.level === 'error' });
    }
  }

  const isSuccess = dbStatus === 'success';
  const isRunning = dbStatus === 'running';

  return PIPELINE_STEPS.map((name, idx): DeploymentStep => {
    const info = stepMap.get(name);
    if (!info) {
      return { name, status: 'pending', startedAt: null, completedAt: null, durationMs: null };
    }
    if (info.hasError) {
      return { name, status: 'failed', startedAt: info.firstAt.toISOString(), completedAt: info.lastAt.toISOString(), durationMs: info.lastAt.getTime() - info.firstAt.getTime() };
    }
    if (isSuccess) {
      return { name, status: 'done', startedAt: info.firstAt.toISOString(), completedAt: info.lastAt.toISOString(), durationMs: info.lastAt.getTime() - info.firstAt.getTime() };
    }
    if (isRunning) {
      const hasLaterStep = PIPELINE_STEPS.slice(idx + 1).some((n) => stepMap.has(n));
      const status: StepStatus = hasLaterStep ? 'done' : 'running';
      return { name, status, startedAt: info.firstAt.toISOString(), completedAt: hasLaterStep ? info.lastAt.toISOString() : null, durationMs: null };
    }
    return { name, status: 'done', startedAt: info.firstAt.toISOString(), completedAt: info.lastAt.toISOString(), durationMs: null };
  });
}

class WizardDeploymentDto {
  repoUrl!: string;
  branch!: string;
  gitToken?: string;
  serverId!: string;
  domain?: string;
  httpsEnabled!: boolean;
  hasCompose!: boolean;
  hasDockerfile!: boolean;
  hasGamadJson!: boolean;
  detectedFramework!: string;
}
