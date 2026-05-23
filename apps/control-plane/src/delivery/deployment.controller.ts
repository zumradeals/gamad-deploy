// C-12 — REST API : création de déploiement.
// POST /deployments → INSERT deployments (PENDING) + enqueue resolve-source.
// Le tenant est injecté par TenantMiddleware — jamais fourni par le client (INV-06).
// git_token : jamais loggé, jamais persisté en clair (CLAUDE.md §8).

import { Controller, Post, Body, Req } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { deployments, projects, withTenantTx } from '@gamad/schema';
import type { LaunchDeploymentRequest, LaunchDeploymentResponse } from '@gamad/contracts';
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
    @Body() body: LaunchDeploymentRequest,
    @Req() req: TenantRequest,
  ): Promise<LaunchDeploymentResponse> {
    const ctx = req.tenant;

    // Vérifie que le projet appartient au tenant courant (INV-06 : ressource étrangère = 404).
    const [project] = await this.db
      .select({ id: projects.id, orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, body.project_id))
      .limit(1);

    if (!project || project.orgId !== ctx.org_id) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException();
    }

    // INSERT deployment (PENDING) — withTenantTx pour isolation tenant.
    let deploymentId!: string;
    await withTenantTx(this.db, ctx, async (tx) => {
      const [dep] = await tx
        .insert(deployments)
        .values({
          projectId: body.project_id,
          triggerType: 'manual',
          triggerUserId: ctx.user_id,
          status: 'pending',
          commitSha: body.ref ?? null,
        })
        .returning({ id: deployments.id });
      deploymentId = dep!.id;
    });

    // Enqueue resolve-source — git_token jamais loggé ni persisté (CLAUDE.md §8).
    const jobData: PipelineJobData = {
      deploymentId,
      orgId: ctx.org_id,
      userId: ctx.user_id,
      repoAnalysis: {
        ...(body.ref ? { ref: { type: 'branch' as const, value: body.ref } } : {}),
        has_dockerfile: false,
        has_compose_file: true,
        has_gamad_json: false,
      },
    };

    await this.queue.add(JobName.RESOLVE_SOURCE, jobData, DEFAULT_JOB_OPTIONS);

    return { deployment_id: deploymentId };
  }
}
