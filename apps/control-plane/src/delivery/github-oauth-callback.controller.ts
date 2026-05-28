// Callback GitHub OAuth — hors TenantMiddleware (ADR-0013).
// Route : GET /auth/github/callback (exclue par le pattern 'auth/(.*)' dans AppModule).
// Valide le state HMAC, échange le code, chiffre le token, persiste, redirige le navigateur.
// git_token : jamais loggé (CLAUDE.md §8).

import { Controller, Get, Query, Res, Inject } from '@nestjs/common';
import type { Response } from 'express';
import {
  verifyOAuthState,
  exchangeCodeForToken,
  getGitHubUser,
  encryptOAuthToken,
} from '../adapters/github-oauth.adapter';
import { GithubOAuthTokenRepository } from '../adapters/github-oauth-token.repository';

@Controller('auth/github')
export class GithubOAuthCallbackController {
  constructor(
    @Inject(GithubOAuthTokenRepository)
    private readonly repo: GithubOAuthTokenRepository,
  ) {}

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';

    if (!code || !state) {
      res.redirect(`${frontendUrl}/app/settings/github?error=missing_params`);
      return;
    }

    try {
      const { org_id, user_id } = verifyOAuthState(state);
      const { token, scopes } = await exchangeCodeForToken(code);
      const ghUser = await getGitHubUser(token);
      const encryptedToken = encryptOAuthToken(token); // token en clair quitte la mémoire ici

      await this.repo.upsert(org_id, user_id, {
        login: ghUser.login,
        githubUserId: ghUser.id,
        encryptedToken,
        scopes,
      });

      res.redirect(`${frontendUrl}/app/settings/github?connected=true`);
    } catch (err) {
      const msg = err instanceof Error ? encodeURIComponent(err.message) : 'unknown';
      console.error('[GithubOAuth callback]', err instanceof Error ? err.message : err);
      res.redirect(`${frontendUrl}/app/settings/github?error=${msg}`);
    }
  }
}
