import { SnapshotPort } from '../ports/snapshot.port';
import type { SnapshotManifest } from '../ports/snapshot.port';

export class SnapshotStub extends SnapshotPort {
  captureCount = 0;
  restoreCount = 0;
  private readonly _existing = new Set<string>();
  private readonly _manifests = new Map<string, SnapshotManifest>();
  // Deployments dont l'état système est passé à S1 (post-déploiement).
  // Si capture() est appelé sur un de ces IDs, le manifest retourné commence par "S1-",
  // permettant au test de vérifier qu'il ne l'est PAS après un replay correctement gardé.
  private readonly _s1States = new Set<string>();

  seedSnapshot(deploymentId: string): void {
    const manifest: SnapshotManifest = {
      deploymentId,
      capturedAt: `S0-${new Date().toISOString()}`,
    };
    this._manifests.set(deploymentId, manifest);
    this._existing.add(deploymentId);
  }

  /** Simule le passage de l'état système à S1 (containers démarrés, fichiers modifiés).
   *  Un éventuel capture() APRÈS cet appel retournerait un manifest "S1-..." différent de S0.
   *  Le test prouve que ensureSnapshot() ne capture PAS après simulateDirtyState() — guard ADR-0007. */
  simulateDirtyState(deploymentId: string): void {
    this._s1States.add(deploymentId);
  }

  override async exists(deploymentId: string): Promise<boolean> {
    return this._existing.has(deploymentId);
  }

  override async capture(deploymentId: string): Promise<SnapshotManifest> {
    this.captureCount++;
    // Le préfixe "S0-" ou "S1-" dans capturedAt rend le contenu vérifiable dans les tests.
    const prefix = this._s1States.has(deploymentId) ? 'S1' : 'S0';
    const manifest: SnapshotManifest = {
      deploymentId,
      capturedAt: `${prefix}-${new Date().toISOString()}`,
    };
    this._manifests.set(deploymentId, manifest);
    this._existing.add(deploymentId);
    return manifest;
  }

  override async getManifest(deploymentId: string): Promise<SnapshotManifest> {
    const manifest = this._manifests.get(deploymentId);
    if (!manifest) throw new Error(`SnapshotStub : aucun manifest pour ${deploymentId}`);
    return manifest;
  }

  override async restore(_deploymentId: string): Promise<void> {
    this.restoreCount++;
    // Le manifest filesystem persiste après restore (ADR-0007 : write-once).
    // On ne supprime PAS _existing : le marker S0 reste présent après la restauration.
  }
}
