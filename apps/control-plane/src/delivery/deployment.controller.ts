// C-12 — REST API : création de déploiement depuis le wizard.
// POST /deployments accepte le payload complet du wizard (repoUrl, branch, serverId, …).
// Crée ou réutilise le projet, insert le déploiement, enqueue resolve-source.
// Le tenant est injecté par TenantMiddleware — jamais fourni par le client (INV-06).
// git_token : jamais loggé, jamais persisté en clair (CLAUDE.md §8).

import { Controller, Post, Body, Req } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { deployments, projects, withTenantTx } from '@gamad/schema';
import type { TenantRequest } from '../persistence/tenant-middleware';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import {
  PIPELINE_QUEUE_TOKEN,
  JobName,
  DEFAULT_JOB_OPTIONS,
} from '../orchestration/pipeline/pipeline.constants';
import type { PipelineJobData } from '../orchestration/pipeline/pipeline.types';

@Controller('deployments')
export class DeploymentController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: NodePgDatabase,
    @Inject(PIPELINE_QUEUE_TOKEN) private readonly queue: Queue,
  ) {}

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
      repoAnalysis: {
        repo_url: body.repoUrl,
        ref: { type: 'branch' as const, value: body.branch },
        has_dockerfile: body.hasDockerfile,
        has_compose_file: body.hasCompose,
        has_gamad_json: body.hasGamadJson,
        detected_framework: body.detectedFramework,
        detected_runtime: body.detectedFramework ? 'node' : '',
      },
    };

    await this.queue.add(JobName.RESOLVE_SOURCE, jobData, DEFAULT_JOB_OPTIONS);

    return { id: deploymentId };
  }
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
