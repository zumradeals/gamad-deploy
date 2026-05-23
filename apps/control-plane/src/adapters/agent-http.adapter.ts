// Adaptateur HTTP de AgentPort — appelle l'agent VPS via C-06/C-07 (INV-09).
// agent_token transmis via Authorization header — jamais loggé (CLAUDE.md §8).

import { Injectable, Inject } from '@nestjs/common';
import type { HealthCheck, PlanDeDeploiementNormalise } from '@gamad/contracts';
import { AgentPort } from '../orchestration/ports/agent.port';

export const AGENT_BASE_URL_TOKEN = 'AGENT_BASE_URL_TOKEN';
export const AGENT_TOKEN_TOKEN = 'AGENT_TOKEN_TOKEN';

@Injectable()
export class AgentHttpAdapter extends AgentPort {
  constructor(
    @Inject(AGENT_BASE_URL_TOKEN) private readonly baseUrl: string,
    @Inject(AGENT_TOKEN_TOKEN) private readonly agentToken: string,
  ) { super(); }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.agentToken}`,
    };
  }

  override async dispatch(
    deploymentId: string,
    pdn: PlanDeDeploiementNormalise,
  ): Promise<{ agentJobId: string }> {
    const res = await fetch(`${this.baseUrl}/deploy`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ deployment_id: deploymentId, resolved_plan: pdn }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agent dispatch échoué (${res.status}) : ${text}`);
    }
    const body = (await res.json()) as { job_id?: string };
    return { agentJobId: body.job_id ?? deploymentId };
  }

  override async rollback(deploymentId: string, _snapshotRef: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/rollback`, {
      method: 'POST',
      headers: this.headers,
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
  ): Promise<{ passed: boolean; details: string[] }> {
    const res = await fetch(`${this.baseUrl}/check-health`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ deployment_id: deploymentId, checks }),
    });
    if (!res.ok) {
      return { passed: false, details: [`HTTP ${res.status}`] };
    }
    const body = (await res.json()) as { passed?: boolean; details?: string[] };
    return { passed: body.passed ?? false, details: body.details ?? [] };
  }
}
