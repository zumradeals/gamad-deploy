// Adaptateur GitHub Publisher — Couche Adapters (INV-09).
// Implémente GitHubPublisherPort. Jamais importé par le Domain.
// Structure du repo créé :
//   gamad-template-<slug>/
//     gamad.json       — contrat certifié
//     README.md        — généré automatiquement
//     .gamad/
//       meta.json      — métadonnées (version, catégorie, auteur)
//
// Sécurité : git_token jamais loggé (CLAUDE.md §8).

import {
  GitHubPublisherPort,
  type PublishTemplateParams,
  type PublishTemplateResult,
} from '../domain/github-publisher/github-publisher.port';

const GITHUB_API = 'https://api.github.com';
const REPO_PREFIX = 'gamad-template-';

type GhHeaders = Record<string, string>;

function headers(token: string): GhHeaders {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/** Crée ou met à jour un fichier dans un repo GitHub via l'API Contents. */
async function upsertFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const encoded = Buffer.from(content, 'utf-8').toString('base64');

  // Récupère le sha si le fichier existe déjà (nécessaire pour l'update).
  const getRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    headers: headers(token),
  });
  let sha: string | undefined;
  if (getRes.ok) {
    const data = await getRes.json() as { sha?: string };
    sha = data.sha;
  }

  const body: Record<string, unknown> = { message, content: encoded };
  if (sha) body['sha'] = sha;

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub upsertFile ${path}: ${res.status} ${err}`);
  }
}

/** Crée un repo public sur GitHub, idempotent (retourne l'URL si déjà existant). */
async function ensureRepo(token: string, owner: string, repoName: string, description: string): Promise<string> {
  // Vérification si le repo existe déjà.
  const checkRes = await fetch(`${GITHUB_API}/repos/${owner}/${repoName}`, {
    headers: headers(token),
  });
  if (checkRes.ok) {
    const data = await checkRes.json() as { html_url: string };
    return data.html_url;
  }

  // Création du repo.
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      name: repoName,
      description,
      private: false,
      auto_init: false,
      has_issues: true,
      has_projects: false,
      has_wiki: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub createRepo: ${res.status} ${err}`);
  }
  const data = await res.json() as { html_url: string };
  return data.html_url;
}

/** Fork un repo dans l'org GAMAD officielle. */
async function forkRepo(
  gamadToken: string,
  sourceOwner: string,
  sourceRepo: string,
  gamadOrg: string,
): Promise<string | null> {
  const res = await fetch(`${GITHUB_API}/repos/${sourceOwner}/${sourceRepo}/forks`, {
    method: 'POST',
    headers: headers(gamadToken),
    body: JSON.stringify({ organization: gamadOrg }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { html_url: string };
  return data.html_url;
}

function buildReadme(p: PublishTemplateParams): string {
  return `# ${p.name}

> Template de déploiement GAMAD — ${p.category}

${p.description}

## Déploiement rapide

1. Connectez votre serveur sur [deploy.gamad.net](https://deploy.gamad.net)
2. Dans le Marketplace, recherchez **${p.name}**
3. Cliquez **Déployer** et suivez les étapes

## Contenu

Ce repo contient un fichier \`gamad.json\` — la recette déclarative de déploiement.
Il définit les services Docker, variables d'environnement, health checks et configuration
reverse-proxy pour déployer ${p.name} sur n'importe quel VPS en quelques minutes.

## Tags

${p.tags.map((t) => `\`${t}\``).join(' ')}

## Version

v${p.version}

---

*Généré automatiquement par [GAMAD Studio](https://deploy.gamad.net)*
`;
}

function buildMeta(p: PublishTemplateParams): string {
  return JSON.stringify(
    {
      name: p.name,
      slug: p.slug,
      category: p.category,
      tags: p.tags,
      version: p.version,
      publishedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export class GitHubPublisherAdapter extends GitHubPublisherPort {
  constructor(
    /** Token GitHub du compte GAMAD officiel (GAMAD_GITHUB_TOKEN). Peut être undefined. */
    private readonly gamadToken: string | undefined,
    /** Nom de l'org GitHub GAMAD où les forks sont hébergés (GAMAD_GITHUB_ORG). */
    private readonly gamadOrg: string | undefined,
  ) {
    super();
  }

  override async publishTemplate(p: PublishTemplateParams): Promise<PublishTemplateResult> {
    const repoName = `${REPO_PREFIX}${p.slug}`;
    const description = `[GAMAD Template] ${p.name} — ${p.category}`;

    // 1. Créer le repo dans l'org/compte de l'utilisateur.
    const userRepoUrl = await ensureRepo(p.userToken, p.githubLogin, repoName, description);

    // 2. Pousser les fichiers.
    const commitMsg = `feat: publish gamad-template v${p.version}`;
    await upsertFile(p.userToken, p.githubLogin, repoName, 'gamad.json', p.contractContent, commitMsg);
    await upsertFile(p.userToken, p.githubLogin, repoName, 'README.md', buildReadme(p), commitMsg);
    await upsertFile(p.userToken, p.githubLogin, repoName, '.gamad/meta.json', buildMeta(p), commitMsg);

    // 3. Fork vers le catalogue GAMAD (optionnel — skip si token absent).
    let gamadForkUrl: string | null = null;
    if (this.gamadToken && this.gamadOrg) {
      gamadForkUrl = await forkRepo(this.gamadToken, p.githubLogin, repoName, this.gamadOrg);
    }

    return { userRepoUrl, gamadForkUrl };
  }
}
