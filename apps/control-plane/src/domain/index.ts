// Couche Domain — logique métier pure, testable hors-ligne (P-02+)
// N'importe QUE packages/contracts. Zéro I/O, zéro dépendance vers delivery/, adapters/, persistence/.
// La règle d'architecture ESLint bloquera tout import interdit depuis ce répertoire.

import type { PlanDeDeploiementNormalise, TenantContext } from '@gamad/contracts';

export type { PlanDeDeploiementNormalise, TenantContext };
