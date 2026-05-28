// Persistance des tokens GitHub OAuth chiffrés (ADR-0013, C-14).
// Le token en clair n'existe que dans la mémoire vive pendant le chiffrement/déchiffrement.
// INV-06 : isolation tenant garantie par (org_id, user_id) dans chaque requête.

import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { githubOauthTokens } from '@gamad/schema';
import { DB_TOKEN } from './pipeline-repository.adapter';

export interface StoredGithubToken {
  githubUserLogin: string;
  githubUserId: number;
  encryptedToken: string;
  scopes: string[];
  connectedAt: Date;
}

@Injectable()
export class GithubOAuthTokenRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  async upsert(
    orgId: string,
    userId: string,
    data: {
      login: string;
      githubUserId: number;
      encryptedToken: string;
      scopes: string[];
    },
  ): Promise<void> {
    await this.db
      .insert(githubOauthTokens)
      .values({
        orgId,
        userId,
        githubUserLogin: data.login,
        githubUserId: data.githubUserId,
        encryptedToken: data.encryptedToken,
        scopes: data.scopes,
      })
      .onConflictDoUpdate({
        target: [githubOauthTokens.orgId, githubOauthTokens.userId],
        set: {
          githubUserLogin: data.login,
          githubUserId: data.githubUserId,
          encryptedToken: data.encryptedToken,
          scopes: data.scopes,
          updatedAt: new Date(),
        },
      });
  }

  async find(orgId: string, userId: string): Promise<StoredGithubToken | null> {
    const [row] = await this.db
      .select()
      .from(githubOauthTokens)
      .where(and(eq(githubOauthTokens.orgId, orgId), eq(githubOauthTokens.userId, userId)))
      .limit(1);

    if (!row) return null;
    return {
      githubUserLogin: row.githubUserLogin,
      githubUserId: Number(row.githubUserId),
      encryptedToken: row.encryptedToken,
      scopes: row.scopes,
      connectedAt: row.connectedAt,
    };
  }

  async delete(orgId: string, userId: string): Promise<void> {
    await this.db
      .delete(githubOauthTokens)
      .where(and(eq(githubOauthTokens.orgId, orgId), eq(githubOauthTokens.userId, userId)));
  }
}
