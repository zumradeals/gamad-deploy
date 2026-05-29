// Port Domain pour la publication de templates sur GitHub (INV-09, C-13).
// Le Domain ne connaît jamais l'API GitHub concrète.

export interface PublishTemplateParams {
  /** Token OAuth GitHub de l'utilisateur (déchiffré, jamais loggé). */
  userToken: string;
  /** Login GitHub de l'utilisateur (org ou perso). */
  githubLogin: string;
  /** Slug du template — devient le nom du repo. */
  slug: string;
  name: string;
  description: string;
  /** gamad.json certifié (string JSON). */
  contractContent: string;
  /** Tags du template pour le README. */
  tags: string[];
  category: string;
  /** Version de la dernière révision certifiée. */
  version: number;
}

export interface PublishTemplateResult {
  /** URL du repo créé/mis à jour dans l'org utilisateur. */
  userRepoUrl: string;
  /** URL du fork dans le catalogue GAMAD officiel (null si GAMAD_GITHUB_TOKEN absent). */
  gamadForkUrl: string | null;
}

export abstract class GitHubPublisherPort {
  abstract publishTemplate(params: PublishTemplateParams): Promise<PublishTemplateResult>;
}
