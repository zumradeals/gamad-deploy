// INV-08 — Port snapshot write-once (ADR-0007).
// exists() est appelé AVANT capture() pour garantir l'idempotence de ensureSnapshot().
// Le manifest persiste la preuve que S0 a été capturé pour ce deploymentId.

export interface SnapshotManifest {
  deploymentId: string;
  capturedAt: string; // ISO 8601
}

export abstract class SnapshotPort {
  abstract exists(deploymentId: string): Promise<boolean>;
  abstract capture(deploymentId: string): Promise<SnapshotManifest>;
  abstract restore(deploymentId: string): Promise<void>;
}
