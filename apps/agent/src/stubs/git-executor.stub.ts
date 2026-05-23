import { GitExecutorPort } from '../ports/git-executor.port';
import type { GitRef } from '../ports/git-executor.port';

export class GitExecutorStub extends GitExecutorPort {
  readonly clones: Array<{ deploymentId: string; url: string; ref: GitRef }> = [];
  private _fail = false;

  setFail(fail: boolean): void { this._fail = fail; }

  override async clone(deploymentId: string, url: string, ref: GitRef): Promise<void> {
    this.clones.push({ deploymentId, url, ref });
    if (this._fail) throw new Error('GitExecutorStub : clone simulé en échec');
  }
}
