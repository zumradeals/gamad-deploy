// Validation runtime d'un PDN contre les invariants C-01.
// Appelé par TemplateCompilerService et SourceInferer avant de retourner le PDN.
// Erreur structurelle = PdnValidationError (jamais de données corrompues en aval).

import type { PlanDeDeploiementNormalise, PdnVersion } from '@gamad/contracts';

const KNOWN_VERSIONS: readonly PdnVersion[] = ['1.0'];

export class PdnValidationError extends Error {
  constructor(public readonly reason: string) {
    super(`PDN invalide : ${reason}`);
    this.name = 'PdnValidationError';
  }
}

export function validatePdn(pdn: PlanDeDeploiementNormalise): void {
  if (!KNOWN_VERSIONS.includes(pdn.pdn_version)) {
    throw new PdnValidationError(`version inconnue "${pdn.pdn_version}" — versions supportées : ${KNOWN_VERSIONS.join(', ')}`);
  }

  // INV-03 : zéro health check interdit — garde runtime en plus du type structurel
  if (pdn.health_checks.length === 0) {
    throw new PdnValidationError('zéro health check — INV-03 exige au moins un health check');
  }

  // ban_latest=true interdit une ref "branch" (non figée) — tag ou commit obligatoire
  if (pdn.policies.ban_latest && pdn.source.ref.type === 'branch') {
    throw new PdnValidationError(
      `ban_latest=true interdit une ref de type "branch" (ref non figée) — utilise "tag" ou "commit"`,
    );
  }

  // UPPER_SNAKE_CASE sur les noms de variables d'environnement
  for (const envVar of pdn.env_vars) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(envVar.name)) {
      throw new PdnValidationError(
        `nom de variable d'environnement invalide : "${envVar.name}" — UPPER_SNAKE_CASE requis`,
      );
    }
  }
}
