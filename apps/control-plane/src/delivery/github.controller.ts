// API GitHub OAuth (ADR-0013, C-14) — derrière TenantMiddleware.
// Expose : auth-url, statut connexion, repos, fork, déconnexion.
// Token jamais dans les réponses (CLAUDE.md §8).

import { Controller, Get, Post, Delete, Body, Req, Inject, Query, BadRequestException } from '@nestjs/common';
import type { GitHubOAuthStatus, GitHubRepo, GitHubForkResult } from '@gamad/contracts';
import type { TenantRequest } from '../persistence/tenant-middleware';
import {
  createOAuthState,
  decryptOAuthToken,
  listGitHubRepos,
  forkGitHubRepo,
} from '../adapters/github-oauth.adapter';
import { GithubOAuthTokenRepository } from '../adapters/github-oauth-token.repository';

interface ForkBody {
  owner: string;
  repo: string;
}

@Controller('github')
export class GithubController {
  constructor(
    @Inject(GithubOAuthTokenRepository)
    private readonly repo: GithubOAuthTokenRepository,
  ) {}

  /** Retourne l'URL d'autorisation GitHub OAuth avec state HMAC (CSRF). */
  @Get('auth-url')
  getAuthUrl(@Req() req: TenantRequest): { url: string } {
    const { org_id, user_id } = req.tenant;
    const clientId = process.env['GITHUB_OAUTH_CLIENT_ID'] ?? '';
    const callbackUrl = process.env['GITHUB_OAUTH_CALLBACK_URL'] ?? '';
    if (!clientId) throw new BadRequestException('GITHUB_OAUTH_CLIENT_ID non configuré');

    const state = createOAuthState(org_id, user_id);
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('scope', 'repo,read:user');
    url.searchParams.set('state', state);

    return { url: url.toString() };
  }

  /** Statut de connexion GitHub — jamais le token (CLAUDE.md §8). */
  @Get('status')
  async getStatus(@Req() req: TenantRequest): Promise<GitHubOAuthStatus> {
    const { org_id, user_id } = req.tenant;
    const stored = await this.repo.find(org_id, user_id);

    if (!stored) return { connected: false };
    return {
      connected: true,
      github_login: stored.githubUserLogin,
      github_user_id: stored.githubUserId,
      scopes: stored.scopes,
      connected_at: stored.connectedAt.toISOString(),
    };
  }

  /** Liste les repos GitHub de l'utilisateur connecté. */
  @Get('repos')
  async listRepos(
    @Req() req: TenantRequest,
    @Query('page') page?: string,
  ): Promise<GitHubRepo[]> {
    const { org_id, user_id } = req.tenant;
    const stored = await this.repo.find(org_id, user_id);
    if (!stored) throw new BadRequestException('GitHub non connecté — appelez /github/auth-url');

    const token = decryptOAuthToken(stored.encryptedToken);
    return listGitHubRepos(token, page ? parseInt(page, 10) : 1);
  }

  /** Fork un repo public sur le compte GitHub de l'utilisateur. */
  @Post('repos/fork')
  async forkRepo(
    @Body() body: ForkBody,
    @Req() req: TenantRequest,
  ): Promise<GitHubForkResult> {
    if (!body.owner || !body.repo) {
      throw new BadRequestException('owner et repo sont requis');
    }
    const { org_id, user_id } = req.tenant;
    const stored = await this.repo.find(org_id, user_id);
    if (!stored) throw new BadRequestException('GitHub non connecté — appelez /github/auth-url');

    const token = decryptOAuthToken(stored.encryptedToken);
    return forkGitHubRepo(token, body.owner, body.repo);
  }

  /** Déconnecte GitHub (supprime le token chiffré en DB). */
  @Delete('connection')
  async disconnect(@Req() req: TenantRequest): Promise<{ disconnected: true }> {
    const { org_id, user_id } = req.tenant;
    await this.repo.delete(org_id, user_id);
    return { disconnected: true };
  }
}
