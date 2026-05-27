// Adaptateur HTTP de AgentPort — appelle l'agent VPS via C-06/C-07 (INV-09).
// Les credentials (host/agentPort/agentToken) sont fournis par appel (lus depuis servers en DB)
// et jamais depuis des variables d'environnement globales — garantit le multi-serveur (INV-09).
// agent_token transmis via Authorization header — jamais loggé (CLAUDE.md §8).

import { Injectable, Inject } from '@nestjs/common';
import type { HealthCheck, PlanDeDeploiementNormalise } from '@gamad/contracts';
import { AgentPort, type ServerEndpoint } from '../orchestration/ports/agent.port';
import { CONTROL_PLANE_URL } from './adapters.module';

@Injectable()
export class AgentHttpAdapter extends AgentPort {
  constructor(
    @Inject(CONTROL_PLANE_URL) private readonly controlPlaneUrl: string,
  ) {
    super();
  }

  private makeHeaders(agentToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${agentToken}`,
    };
  }

  private baseUrl(server: ServerEndpoint): string {
    return `http://${server.host}:${server.agentPort}`;
  }

  override async dispatch(
    deploymentId: string,
    pdn: PlanDeDeploiementNormalise,
    server: ServerEndpoint,
  ): Promise<{ agentJobId: string }> {
    const callbackUrl = `${this.controlPlaneUrl}/agent/callback`;
    const res = await fetch(`${this.baseUrl(server)}/deploy`, {
      method: 'POST',
      headers: this.makeHeaders(server.agentToken),
      body: JSON.stringify({ deployment_id: deploymentId, resolved_plan: pdn, callback_url: callbackUrl }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agent dispatch échoué (${res.status}) : ${text}`);
    }
    const body = (await res.json()) as { job_id?: string };
    return { agentJobId: body.job_id ?? deploymentId };
  }

  override async rollback(
    deploymentId: string,
    _snapshotRef: string,
    server: ServerEndpoint,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl(server)}/rollback`, {
      method: 'POST',
      headers: this.makeHeaders(server.agentToken),
      body: JSON.stringify({ deployment_id: deploymentId }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agent rollback échoué (${res.status}) : ${text}`);
    }
  }

  override async checkHealth(
    deploymentId: string,
    checks: HealthCheck[],
    server: ServerEndpoint,
  ): Promise<{ passed: boolean; details: string[] }> {
    const res = await fetch(`${this.baseUrl(server)}/check-health`, {
      method: 'POST',
      headers: this.makeHeaders(server.agentToken),
      body: JSON.stringify({ deployment_id: deploymentId, checks }),
    });
    if (!res.ok) {
      return { passed: false, details: [`HTTP ${res.status}`] };
    }
    const body = (await res.json()) as { passed?: boolean; details?: string[] };
    return { passed: body.passed ?? false, details: body.details ?? [] };
  }
}
