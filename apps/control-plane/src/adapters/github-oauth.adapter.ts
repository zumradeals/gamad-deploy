// Utilitaires GitHub OAuth (ADR-0013, C-14).
// Crypto : AES-256-GCM — token chiffré au repos, jamais en clair (CLAUDE.md §8).
// CSRF state : HMAC-SHA256 auto-signé avec CLIENT_SECRET, expiration 10 min.
// Aucune dépendance externe : node:crypto uniquement.

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { GitHubRepo, GitHubForkResult } from '@gamad/contracts';

const ALGO = 'aes-256-gcm';

// ── Crypto ────────────────────────────────────────────────────────────────────

function getTokenKey(): Buffer {
  const b64 = process.env['GITHUB_OAUTH_TOKEN_KEY'];
  if (!b64) throw new Error('GITHUB_OAUTH_TOKEN_KEY non configuré');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('GITHUB_OAUTH_TOKEN_KEY doit être 32 octets (base64)');
  return key;
}

/** Chiffre un token OAuth GitHub. Format : base64(iv[12] + tag[16] + ciphertext). */
export function encryptOAuthToken(plaintext: string): string {
  const key = getTokenKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Déchiffre un token OAuth GitHub stocké. */
export function decryptOAuthToken(ciphertext: string): string {
  const key = getTokenKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ── CSRF state ────────────────────────────────────────────────────────────────

/** Génère un state HMAC-SHA256 auto-signé (10 min TTL). */
export function createOAuthState(orgId: string, userId: string): string {
  const exp = Date.now() + 600_000;
  const payload = Buffer.from(JSON.stringify({ org_id: orgId, user_id: userId, exp })).toString('base64url');
  const secret = process.env['GITHUB_OAUTH_CLIENT_SECRET'] ?? '';
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Valide et décode le state. Lève une erreur si invalide ou expiré. */
export function verifyOAuthState(state: string): { org_id: string; user_id: string } {
  const dot = state.lastIndexOf('.');
  if (dot === -1) throw new Error('State OAuth invalide');
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const secret = process.env['GITHUB_OAUTH_CLIENT_SECRET'] ?? '';
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig !== expected) throw new Error('State OAuth invalide — CSRF possible');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    org_id: string;
    user_id: string;
    exp: number;
  };
  if (Date.now() > data.exp) throw new Error('State OAuth expiré (>10 min)');
  return { org_id: data.org_id, user_id: data.user_id };
}

// ── GitHub API ────────────────────────────────────────────────────────────────

const GH_API = 'https://api.github.com';

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

interface GHTokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GHUser {
  id: number;
  login: string;
}

/** Échange le code OAuth contre un token d'accès. Token jamais loggé (CLAUDE.md §8). */
export async function exchangeCodeForToken(
  code: string,
): Promise<{ token: string; scopes: string[] }> {
  const clientId = process.env['GITHUB_OAUTH_CLIENT_ID'] ?? '';
  const clientSecret = process.env['GITHUB_OAUTH_CLIENT_SECRET'] ?? '';
  const callbackUrl = process.env['GITHUB_OAUTH_CALLBACK_URL'] ?? '';

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  });
  if (!res.ok) throw new Error(`GitHub token exchange HTTP ${res.status}`);
  const data = (await res.json()) as GHTokenResponse;
  if (data.error ?? !data.access_token) {
    throw new Error(`GitHub OAuth erreur: ${data.error_description ?? data.error ?? 'unknown'}`);
  }
  const scopes = (data.scope ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return { token: data.access_token!, scopes };
}

/** Récupère le login et l'id GitHub de l'utilisateur. */
export async function getGitHubUser(token: string): Promise<GHUser> {
  const res = await fetch(`${GH_API}/user`, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`GitHub /user HTTP ${res.status}`);
  return (await res.json()) as GHUser;
}

/** Liste les repos de l'utilisateur connecté (50 par page, triés par date de MAJ). */
export async function listGitHubRepos(token: string, page = 1): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${GH_API}/user/repos?type=all&per_page=50&page=${page}&sort=updated`,
    { headers: ghHeaders(token) },
  );
  if (!res.ok) throw new Error(`GitHub /user/repos HTTP ${res.status}`);
  const raw = (await res.json()) as Array<{
    id: number; name: string; full_name: string; private: boolean;
    default_branch: string; html_url: string; description: string | null;
  }>;
  return raw.map((r) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    private: r.private,
    default_branch: r.default_branch,
    html_url: r.html_url,
    description: r.description,
  }));
}

/** Fork un repo public sur le compte de l'utilisateur. Async côté GitHub (~quelques s). */
export async function forkGitHubRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<GitHubForkResult> {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/forks`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub fork HTTP ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { html_url: string; full_name: string; default_branch: string };
  return {
    fork_url: data.html_url,
    full_name: data.full_name,
    default_branch: data.default_branch,
  };
}
