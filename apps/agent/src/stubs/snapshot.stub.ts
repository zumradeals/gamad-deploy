import { SnapshotPort } from '../ports/snapshot.port';
import type { SnapshotManifest } from '../ports/snapshot.port';

export class SnapshotStub extends SnapshotPort {
  captureCount = 0;
  restoreCount = 0;
  private _existing = new Set<string>();

  seedSnapshot(deploymentId: string): void {
    this._existing.add(deploymentId);
  }

  override async exists(deploymentId: string): Promise<boolean> {
    return this._existing.has(deploymentId);
  }

  override async capture(deploymentId: string): Promise<SnapshotManifest> {
    this.captureCount++;
    this._existing.add(deploymentId);
    return { deploymentId, capturedAt: new Date().toISOString() };
  }

  override async restore(deploymentId: string): Promise<void> {
    this.restoreCount++;
    this._existing.delete(deploymentId); // snapshot consommé après restore
  }
}
