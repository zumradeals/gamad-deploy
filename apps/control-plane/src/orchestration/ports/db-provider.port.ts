// C-09 — Port vers le fournisseur de base de données (INV-09).
// provision() → crée la base de données isolée pour ce déploiement.
// migrate() → applique les migrations de schéma (idempotent par table de tracking).
// Les deux opérations sont idempotentes côté implémentation (CREATE IF NOT EXISTS,
// migrations versionées). Voir Étape 0 P-03 §(a) pour le détail par job.

export abstract class DbProviderPort {
  abstract provision(deploymentId: string): Promise<{ dbRef: string }>;

  abstract migrate(
    deploymentId: string,
    migrationIds: string[],
  ): Promise<{ appliedCount: number }>;
}
