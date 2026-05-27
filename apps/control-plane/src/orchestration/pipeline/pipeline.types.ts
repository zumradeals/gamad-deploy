import type { RepoAnalysis } from '@gamad/contracts';

// Données portées par chaque job BullMQ du pipeline.
// Toutes les informations nécessaires à l'idempotence et au contexte tenant.
export interface PipelineJobData {
  /** UUID v4 du déploiement (INV-05). */
  deploymentId: string;
  /** UUID v4 de l'organisation — construit TenantContext côté job (INV-06). */
  orgId: string;
  /** UUID v4 de l'utilisateur ayant déclenché le déploiement (INV-06). */
  userId: string;
  /** UUID v4 du serveur VPS cible — requis pour dispatch-agent et await-health. */
  serverId: string;
  /** Présent uniquement pour resolve-source ; absent pour les étapes suivantes. */
  repoAnalysis?: RepoAnalysis;
}
