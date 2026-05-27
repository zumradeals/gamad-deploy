// Étape 5/5 du pipeline C-05.
// Poll les health checks jusqu'à passage ou timeout (INV-03 : succès = checks OK).
// Transition RUNNING → SUCCESS si tous les checks passent.
// Transition RUNNING → FAILED (via runner) si timeout.
// Boucle bornée : maxAttempts × intervalMs configurable pour les tests (intervalMs=0).

import { Injectable, Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { JobName, AWAIT_HEALTH_INTERVAL_MS, AWAIT_HEALTH_MAX_ATTEMPTS } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';
import { PipelineJobRunner } from './pipeline-job-runner';
import { AgentPort } from '../ports/agent.port';

@Injectable()
export class AwaitHealthProcessor {
  constructor(
    @Inject(PipelineJobRunner)
    private readonly runner: PipelineJobRunner,
    @Inject(AgentPort)
    private readonly agentPort: AgentPort,
    @Inject(AWAIT_HEALTH_INTERVAL_MS)
    private readonly intervalMs: number = 5_000,
    @Inject(AWAIT_HEALTH_MAX_ATTEMPTS)
    private readonly maxAttempts: number = 12,
  ) {}

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { deploymentId, serverId } = job.data;

    await this.runner.run(JobName.AWAIT_HEALTH, job.data, async (ctx) => {
      const pdn = await this.runner.repo.getPlan(deploymentId);
      if (!pdn) throw new Error('PDN introuvable — resolve-source doit précéder await-health');
      if (!serverId) throw new Error('serverId manquant dans le job await-health');

      const server = await this.runner.repo.getServer(serverId, ctx.tenantCtx);

      for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
        const result = await this.agentPort.checkHealth(deploymentId, pdn.health_checks, server);

        if (result.passed) {
          const currentState = await this.runner.repo.getDeploymentState(deploymentId, ctx.tenantCtx);
          // Domain valide RUNNING → SUCCESS (INV-03 : succès = checks OK, jamais "build réussi").
          await ctx.transition(currentState, 'SUCCESS', 'Tous les health checks ont passé');
          return;
        }

        await ctx.log(
          `Health check tentative ${attempt + 1}/${this.maxAttempts} : ${result.details.join(', ')}`,
          'info',
        );

        if (attempt < this.maxAttempts - 1 && this.intervalMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, this.intervalMs));
        }
      }

      throw new Error(`Health checks en échec après ${this.maxAttempts} tentatives (INV-03)`);
    });
  }
}
