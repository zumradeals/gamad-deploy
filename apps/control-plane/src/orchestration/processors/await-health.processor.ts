// Étape 5/5 du pipeline C-05.
// Poll les health checks jusqu'à passage ou timeout (INV-03 : succès = checks OK).
// Transition RUNNING → SUCCESS si tous les checks passent.
// Transition RUNNING → FAILED (via runner) si timeout.
// Boucle bornée : maxAttempts × intervalMs configurable pour les tests (intervalMs=0).

import type { Job } from 'bullmq';
import { JobName } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';
import type { PipelineJobRunner } from './pipeline-job-runner';
import type { AgentPort } from '../ports/agent.port';

export class AwaitHealthProcessor {
  constructor(
    private readonly runner: PipelineJobRunner,
    private readonly agentPort: AgentPort,
    private readonly intervalMs: number = 5_000,
    private readonly maxAttempts: number = 12,
  ) {}

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { deploymentId } = job.data;

    await this.runner.run(JobName.AWAIT_HEALTH, job.data, async (ctx) => {
      const pdn = await this.runner.repo.getPlan(deploymentId);
      if (!pdn) throw new Error('PDN introuvable — resolve-source doit précéder await-health');

      for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
        const result = await this.agentPort.checkHealth(deploymentId, pdn.health_checks);

        if (result.passed) {
          const currentState = await this.runner.repo.getDeploymentState(deploymentId);
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
