// Module racine de la couche Orchestration.
// Configure BullMQ + Redis (connexion via variables d'environnement REDIS_HOST/REDIS_PORT).
// Exporte PipelineModule + REDIS_CONNECTION pour que AppModule puisse créer le Worker.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PipelineModule } from './pipeline.module';
import { PipelineWorkerService } from './pipeline-worker.service';
import { REDIS_CONNECTION } from './pipeline/pipeline.constants';

const redisConnectionFactory = {
  provide: REDIS_CONNECTION,
  useValue: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  },
};

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
  providers: [redisConnectionFactory, PipelineWorkerService],
  exports: [PipelineModule, PipelineWorkerService, REDIS_CONNECTION],
})
export class OrchestrationModule {}
