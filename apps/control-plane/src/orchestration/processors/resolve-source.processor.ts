// Étape 1/5 du pipeline C-05.
// Résout la source → PDN via SourceResolverService (Domain pur, aucune I/O ici).
// Transition PENDING → RUNNING (première étape du pipeline).
// Idempotence (INV-07) : si deployment_plans existe déjà pour ce deploymentId → skip.

import { Injectable, Inject } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { SourceResolverService } from '../../domain/index';
import { JobName, DEFAULT_JOB_OPTIONS, PIPELINE_QUEUE_TOKEN } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';
import { PipelineJobRunner } from './pipeline-job-runner';

@Injectable()
export class ResolveSourceProcessor {
  constructor(
    @Inject(PipelineJobRunner)
    private readonly runner: PipelineJobRunner,
    @Inject(SourceResolverService)
    private readonly sourceResolver: SourceResolverService,
    @Inject(PIPELINE_QUEUE_TOKEN)
    private readonly queue: Queue,
  ) {}

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { deploymentId, repoAnalysis } = job.data;

    await this.runner.run(JobName.RESOLVE_SOURCE, job.data, async (ctx) => {
      const currentState = await this.runner.repo.getDeploymentState(deploymentId, ctx.tenantCtx);

      // Domain valide PENDING → RUNNING avant toute écriture.
      await ctx.transition(currentState, 'RUNNING', 'Démarrage du pipeline de déploiement');

      // Appel Domain pur (synchrone, zéro I/O — garantie testable hors-ligne P-02).
      if (!repoAnalysis) throw new Error('repoAnalysis manquant dans le job resolve-source');
      const pdn = this.sourceResolver.resolve(repoAnalysis);

      await this.runner.repo.savePlan(deploymentId, pdn, ctx.tenantCtx);
      await ctx.log('PDN calculé et persisté');

      await this.queue.add(JobName.PROVISION_DB, job.data, DEFAULT_JOB_OPTIONS);
    });
  }
}
