// Étape 4/5 du pipeline C-05.
// Envoie le PDN à l'agent VPS pour exécution (C-06/C-07).
// Idempotence (INV-07) : l'agent vérifie le deploymentId côté stub/implémentation réelle ;
// un double dispatch pour le même deploymentId est absorbé.
// Les credentials du serveur (host/agentPort/agentToken) sont lus depuis la DB — jamais depuis
// des env vars globaux — pour garantir le routage multi-serveur correct (INV-09).

import { Injectable, Inject } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import type { PlanDeDeploiementNormalise } from '@gamad/contracts';
import { JobName, AWAIT_HEALTH_JOB_OPTIONS, PIPELINE_QUEUE_TOKEN } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';
import { PipelineJobRunner } from './pipeline-job-runner';
import { AgentPort } from '../ports/agent.port';

// Embarque le token dans l'URL HTTPS uniquement au moment du dispatch (INV-09, CLAUDE.md §8).
// Le PDN persisté en DB garde l'URL propre — le token n'existe que dans Redis (removeOnComplete: true).
function withAuthUrl(pdn: PlanDeDeploiementNormalise, token: string): PlanDeDeploiementNormalise {
  try {
    const parsed = new URL(pdn.source.url);
    if (parsed.protocol === 'https:') {
      parsed.username = token;
      parsed.password = '';
      return { ...pdn, source: { ...pdn.source, url: parsed.toString() } };
    }
  } catch { /* URL invalide ou SSH → PDN inchangé */ }
  return pdn;
}

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
    const { deploymentId, serverId } = job.data;

    await this.runner.run(JobName.DISPATCH_AGENT, job.data, async (ctx) => {
      const pdn = await this.runner.repo.getPlan(deploymentId);
      if (!pdn) throw new Error('PDN introuvable — resolve-source doit précéder dispatch-agent');
      if (!serverId) throw new Error('serverId manquant dans le job dispatch-agent');

      const server = await this.runner.repo.getServer(serverId, ctx.tenantCtx);
      const pdnWithAuth = job.data.gitToken ? withAuthUrl(pdn, job.data.gitToken) : pdn;
      const { agentJobId } = await this.agentPort.dispatch(deploymentId, pdnWithAuth, server);
      await ctx.log(`Agent dispatché, agentJobId=${agentJobId}`);

      await this.queue.add(JobName.AWAIT_HEALTH, job.data, AWAIT_HEALTH_JOB_OPTIONS);
    });
  }
}
