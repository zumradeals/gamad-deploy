// C-06 — Callbacks agent → control plane.
// POST /agent/callback → INSERT deployment_logs (append-only, INV-04).
// Les callbacks ne déclenchent JAMAIS une transition d'état (INV-03 : SUCCESS = health checks).
// L'agent_token est validé dans un middleware dédié (non encore implémenté en P-05).

import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { deploymentLogs } from '@gamad/schema';
import type { AgentCallbackPayload } from '@gamad/contracts';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';

@Controller('agent')
export class CallbackController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  @Post('callback')
  @HttpCode(204)
  async callback(@Body() payload: AgentCallbackPayload): Promise<void> {
    // INSERT-only : jamais de transition ici (INV-03, INV-04).
    await this.db.insert(deploymentLogs).values({
      deploymentId: payload.deployment_id,
      step: payload.event,
      level: (payload.level === 'error' ? 'error' : 'info') as 'info' | 'error',
      message: payload.message ?? payload.event,
      payload: payload.payload,
    });
  }
}
