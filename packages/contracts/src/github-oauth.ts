// C-14 — GitHub OAuth
// Représente l'état de connexion OAuth GitHub d'un utilisateur (par org+user).
// Le token d'accès n'est JAMAIS exposé dans ce contrat (chiffré au repos, ADR-0013).
// Le frontend ne reçoit que le statut et le login — jamais le token.

export interface GitHubOAuthStatus {
  connected: boolean;
  github_login?: string;
  github_user_id?: number;
  /** Scopes autorisés par l'utilisateur (ex. ['repo', 'read:user']). */
  scopes?: string[];
  connected_at?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  description: string | null;
}

export interface GitHubForkResult {
  fork_url: string;
  full_name: string;
  default_branch: string;
}
