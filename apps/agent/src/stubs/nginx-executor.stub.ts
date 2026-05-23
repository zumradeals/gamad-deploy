import { NginxExecutorPort } from '../ports/nginx-executor.port';
import type { NginxConfig } from '../ports/nginx-executor.port';

export class NginxExecutorStub extends NginxExecutorPort {
  readonly configs: Array<{ deploymentId: string; config: NginxConfig }> = [];
  readonly reloads: number[] = [];
  readonly restoredSnapshots: string[] = [];

  override async writeConfig(deploymentId: string, config: NginxConfig): Promise<void> {
    this.configs.push({ deploymentId, config });
  }

  override async reload(): Promise<void> {
    this.reloads.push(Date.now());
  }

  override async restoreFromSnapshot(deploymentId: string): Promise<void> {
    this.restoredSnapshots.push(deploymentId);
  }
}
