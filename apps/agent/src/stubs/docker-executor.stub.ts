import { DockerExecutorPort } from '../ports/docker-executor.port';

export class DockerExecutorStub extends DockerExecutorPort {
  readonly composedUp: Array<{ deploymentId: string; composePath: string }> = [];
  readonly stoppedDeployments: string[] = [];
  private _runningDeployments = new Set<string>();

  setRunning(deploymentId: string, running: boolean): void {
    if (running) this._runningDeployments.add(deploymentId);
    else this._runningDeployments.delete(deploymentId);
  }

  override async composeUp(deploymentId: string, composePath: string): Promise<void> {
    this.composedUp.push({ deploymentId, composePath });
    this._runningDeployments.add(deploymentId);
  }

  override async composeDown(deploymentId: string): Promise<void> {
    this.stoppedDeployments.push(deploymentId);
    this._runningDeployments.delete(deploymentId);
  }

  override async isRunning(deploymentId: string): Promise<boolean> {
    return this._runningDeployments.has(deploymentId);
  }
}
