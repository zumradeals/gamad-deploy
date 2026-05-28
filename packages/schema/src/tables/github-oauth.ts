// ADR-0013 — GitHub OAuth tokens (C-14)
// Token chiffré AES-256-GCM (CLAUDE.md §8). Jamais de token en clair en DB.
// Contrainte unique (org_id, user_id) : un seul compte GitHub par utilisateur par org.

import { pgTable, uuid, text, bigint, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations, users } from './identity';

export const githubOauthTokens = pgTable(
  'github_oauth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    githubUserLogin: text('github_user_login').notNull(),
    githubUserId: bigint('github_user_id', { mode: 'number' }).notNull(),
    /** 🔑 Token OAuth GitHub chiffré AES-256-GCM (ADR-0013). Jamais loggé. */
    encryptedToken: text('encrypted_token').notNull(),
    scopes: text('scopes').array().notNull().default([]),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgUserUniq: uniqueIndex('github_oauth_tokens_org_user_uniq').on(table.orgId, table.userId),
  }),
);
