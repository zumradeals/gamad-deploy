// INV-10 — Validation structurelle du PDN avant toute exécution.
// Le PDN ne peut pas exprimer une commande shell (pas de champ executeCommand).
// Ce validateur protège les champs interpolables contre l'injection shell ou path traversal.
// Lève PdnSecurityValidatorError AVANT tout appel de port → zéro exécution sur PDN malveillant.

import type { PlanDeDeploiementNormalise } from '@gamad/contracts';

export class PdnSecurityValidatorError extends Error {
  constructor(field: string, reason: string) {
    super(`PDN security violation — ${field} : ${reason}`);
    this.name = 'PdnSecurityValidatorError';
  }
}

// Caractères interdits dans tout champ interpolable (ref.value, domain, compose_file).
const SHELL_INJECTION_PATTERN = /[;&|$(){}<>`'"!*\\\n\r\t]/;

// La source.url doit être un git URL valide (https:// ou git@host:).
const VALID_GIT_URL_PATTERN = /^(https?:\/\/|git@)/;

// Le compose_file doit être un chemin relatif sans traversal.
const PATH_TRAVERSAL_PATTERN = /\.\./;
const ABSOLUTE_PATH_PATTERN = /^\//;

export class PdnSecurityValidatorService {
  validate(pdn: PlanDeDeploiementNormalise): void {
    this.validateRef(pdn.source.ref.value);
    this.validateSourceUrl(pdn.source.url);
    if (pdn.artifact.compose_file !== undefined) {
      this.validateComposePath(pdn.artifact.compose_file);
    }
    if (pdn.proxy.domain !== undefined) {
      this.validateDomain(pdn.proxy.domain);
    }
  }

  private validateRef(value: string): void {
    if (SHELL_INJECTION_PATTERN.test(value)) {
      throw new PdnSecurityValidatorError('source.ref.value', `contient un caractère interdit : ${JSON.stringify(value)}`);
    }
    if (value.trim() === '') {
      throw new PdnSecurityValidatorError('source.ref.value', 'ne peut pas être vide');
    }
  }

  private validateSourceUrl(url: string): void {
    if (!VALID_GIT_URL_PATTERN.test(url)) {
      throw new PdnSecurityValidatorError('source.url', `protocole non autorisé (attendu https:// ou git@) : ${JSON.stringify(url)}`);
    }
    if (SHELL_INJECTION_PATTERN.test(url)) {
      throw new PdnSecurityValidatorError('source.url', `contient un caractère interdit : ${JSON.stringify(url)}`);
    }
  }

  private validateComposePath(composePath: string): void {
    if (ABSOLUTE_PATH_PATTERN.test(composePath)) {
      throw new PdnSecurityValidatorError('artifact.compose_file', `chemin absolu interdit : ${JSON.stringify(composePath)}`);
    }
    if (PATH_TRAVERSAL_PATTERN.test(composePath)) {
      throw new PdnSecurityValidatorError('artifact.compose_file', `path traversal interdit : ${JSON.stringify(composePath)}`);
    }
    if (SHELL_INJECTION_PATTERN.test(composePath)) {
      throw new PdnSecurityValidatorError('artifact.compose_file', `contient un caractère interdit : ${JSON.stringify(composePath)}`);
    }
  }

  private validateDomain(domain: string): void {
    if (SHELL_INJECTION_PATTERN.test(domain)) {
      throw new PdnSecurityValidatorError('proxy.domain', `contient un caractère interdit : ${JSON.stringify(domain)}`);
    }
    // Domaine valide : lettres, chiffres, tirets et points uniquement.
    if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
      throw new PdnSecurityValidatorError('proxy.domain', `format invalide : ${JSON.stringify(domain)}`);
    }
  }
}
