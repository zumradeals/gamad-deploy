// INV-08 — Port snapshot write-once (ADR-0007).
// exists() est appelé AVANT capture() pour garantir l'idempotence de ensureSnapshot().
// getManifest() retourne le manifest S0 sans le recapturer — utilisé par le guard write-once.
// Le manifest persiste la preuve que S0 a été capturé pour ce deploymentId.

export interface SnapshotManifest {
  deploymentId: string;
  capturedAt: string; // ISO 8601, préfixé "S0-" en stub pour prouver le contenu
}

export abstract class SnapshotPort {
  abstract exists(deploymentId: string): Promise<boolean>;
  abstract capture(deploymentId: string): Promise<SnapshotManifest>;
  /** Retourne le manifest S0 existant sans capture — appelé par ensureSnapshot quand exists()=true. */
  abstract getManifest(deploymentId: string): Promise<SnapshotManifest>;
  abstract restore(deploymentId: string): Promise<void>;
}
