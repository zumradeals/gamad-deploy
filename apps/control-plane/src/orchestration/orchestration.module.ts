// Module racine de la couche Orchestration.
// Configure BullMQ + Redis (connexion via variables d'environnement REDIS_HOST/REDIS_PORT).
// Exporte PipelineModule pour que les modules supérieurs puissent enqueuer des jobs.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PipelineModule } from './pipeline.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      },
    }),
    PipelineModule,
  ],
  exports: [PipelineModule],
})
export class OrchestrationModule {}
