// Étape 3/5 du pipeline C-05.
// Applique les migrations de schéma sur la base provisionnée.
// Idempotence (INV-07) : les migrations sont versionées — re-run = skip des déjà appliquées.
// Pas de transition d'état : on reste RUNNING, on journalise seulement.

import type { Job, Queue } from 'bullmq';
import { JobName, DEFAULT_JOB_OPTIONS } from '../pipeline/pipeline.constants';
import type { PipelineJobData } from '../pipeline/pipeline.types';
import type { PipelineJobRunner } from './pipeline-job-runner';
import type { DbProviderPort } from '../ports/db-provider.port';

export class MigrateDataProcessor {
  constructor(
    private readonly runner: PipelineJobRunner,
    private readonly dbProvider: DbProviderPort,
    private readonly queue: Queue,
  ) {}

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { deploymentId } = job.data;

    await this.runner.run(JobName.MIGRATE_DATA, job.data, async (ctx) => {
      // Les IDs de migrations viendraient du PDN en v2 ; vide acceptable en P-03.
      const { appliedCount } = await this.dbProvider.migrate(deploymentId, []);
      await ctx.log(`${appliedCount} migration(s) appliquée(s)`);

      await this.queue.add(JobName.DISPATCH_AGENT, job.data, DEFAULT_JOB_OPTIONS);
    });
  }
}
