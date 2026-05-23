// Étape 4/5 du pipeline C-05.
// Envoie le PDN à l'agent VPS pour exécution (C-06/C-07).
// Idempotence (INV-07) : l'agent vérifie le deploymentId côté stub/implémentation réelle ;
// un double dispatch pour le même deploymentId est absorbé.
// Pas de transition d'état : on reste RUNNING, on journalise le agentJobId.

import { Injectable, Inject } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { JobName, AWAIT_HEALTH_JOB_OPTIONS, PIPELINE_QUEUE_TOKEN } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';
import { PipelineJobRunner } from './pipeline-job-runner';
import { AgentPort } from '../ports/agent.port';

@Injectable()
export class DispatchAgentProcessor {
  constructor(
    @Inject(PipelineJobRunner)
    private readonly runner: PipelineJobRunner,
    @Inject(AgentPort)
    private readonly agentPort: AgentPort,
    @Inject(PIPELINE_QUEUE_TOKEN)
    private readonly queue: Queue,
  ) {}

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { deploymentId } = job.data;

    await this.runner.run(JobName.DISPATCH_AGENT, job.data, async (ctx) => {
      const pdn = await this.runner.repo.getPlan(deploymentId);
      if (!pdn) throw new Error('PDN introuvable — resolve-source doit précéder dispatch-agent');

      const { agentJobId } = await this.agentPort.dispatch(deploymentId, pdn);
      await ctx.log(`Agent dispatché, agentJobId=${agentJobId}`);

      await this.queue.add(JobName.AWAIT_HEALTH, job.data, AWAIT_HEALTH_JOB_OPTIONS);
    });
  }
}
