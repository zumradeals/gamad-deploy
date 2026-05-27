// Stub injectables de AgentPort — usage : tests P-03, développement hors P-04.
// Enregistre chaque appel pour assertions ; configurable pour simuler échec.

import { Injectable } from '@nestjs/common';
import type { HealthCheck, PlanDeDeploiementNormalise } from '@gamad/contracts';
import { AgentPort, type ServerEndpoint } from '../ports/agent.port';

@Injectable()
export class AgentStub extends AgentPort {
  readonly dispatches: Array<{ deploymentId: string; pdn: PlanDeDeploiementNormalise }> = [];
  readonly rollbacks: Array<{ deploymentId: string; snapshotRef: string }> = [];
  readonly healthChecks: Array<{ deploymentId: string }> = [];

  private _failDispatch = false;
  private _healthPassed = true;

  setDispatchFail(fail: boolean): void { this._failDispatch = fail; }
  setHealthPassed(passed: boolean): void { this._healthPassed = passed; }

  override async dispatch(
    deploymentId: string,
    pdn: PlanDeDeploiementNormalise,
    _server: ServerEndpoint,
  ): Promise<{ agentJobId: string }> {
    this.dispatches.push({ deploymentId, pdn });
    if (this._failDispatch) throw new Error('AgentStub : dispatch simulé en échec');
    return { agentJobId: `stub-${deploymentId}` };
  }

  override async rollback(
    deploymentId: string,
    snapshotRef: string,
    _server: ServerEndpoint,
  ): Promise<void> {
    this.rollbacks.push({ deploymentId, snapshotRef });
  }

  override async checkHealth(
    deploymentId: string,
    _checks: HealthCheck[],
    _server: ServerEndpoint,
  ): Promise<{ passed: boolean; details: string[] }> {
    this.healthChecks.push({ deploymentId });
    return { passed: this._healthPassed, details: this._healthPassed ? [] : ['stub: check failed'] };
  }
}
