// Stub injectable de DbProviderPort — usage : tests P-03.
// Simule provision idempotente et migration versionée.

import { Injectable } from '@nestjs/common';
import { DbProviderPort } from '../ports/db-provider.port';

@Injectable()
export class DbProviderStub extends DbProviderPort {
  readonly provisions: string[] = [];
  readonly migrations: Array<{ deploymentId: string; ids: string[] }> = [];

  private _failProvision = false;

  setProvisionFail(fail: boolean): void { this._failProvision = fail; }

  override async provision(deploymentId: string): Promise<{ dbRef: string }> {
    this.provisions.push(deploymentId);
    if (this._failProvision) throw new Error('DbProviderStub : provision simulée en échec');
    return { dbRef: `stub-db-${deploymentId}` };
  }

  override async migrate(
    deploymentId: string,
    migrationIds: string[],
  ): Promise<{ appliedCount: number }> {
    this.migrations.push({ deploymentId, ids: migrationIds });
    return { appliedCount: migrationIds.length };
  }
}
