// Étape 2/5 du pipeline C-05.
// Provisionne la base de données isolée pour ce déploiement.
// Idempotence (INV-07) : CREATE IF NOT EXISTS côté DbProviderPort.
// Pas de transition d'état : on reste RUNNING, on journalise seulement.

import type { Job, Queue } from 'bullmq';
import { JobName, DEFAULT_JOB_OPTIONS } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';
import type { PipelineJobRunner } from './pipeline-job-runner';
import type { DbProviderPort } from '../ports/db-provider.port';

export class ProvisionDbProcessor {
  constructor(
    private readonly runner: PipelineJobRunner,
    private readonly dbProvider: DbProviderPort,
    private readonly queue: Queue,
  ) {}

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { deploymentId } = job.data;

    await this.runner.run(JobName.PROVISION_DB, job.data, async (ctx) => {
      const { dbRef } = await this.dbProvider.provision(deploymentId);
      await ctx.log(`Base de données provisionnée : ${dbRef}`);

      await this.queue.add(JobName.MIGRATE_DATA, job.data, DEFAULT_JOB_OPTIONS);
    });
  }
}
