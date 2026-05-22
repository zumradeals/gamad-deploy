// docs/03 §3.4 — domaine PROJETS & SOURCES (C-02, C-03)
// org_id NOT NULL sur projects (INV-06). git_token 🔑 jamais loggé.

import { pgTable, uuid, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projectStatusEnum } from '../enums';
import { organizations } from './identity';
import { servers } from './infrastructure';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  serverId: uuid('server_id').references(() => servers.id),
  name: text('name').notNull(),
  repoUrl: text('repo_url').notNull(),
  repoBranch: text('repo_branch').notNull().default('main'),
  /** 🔑 Token Git — chiffré au repos, jamais loggé (CLAUDE.md §8). */
  gitToken: text('git_token'),
  domain: text('domain'),
  enableHttps: boolean('enable_https').notNull().default(true),
  enableAutoDeploy: boolean('enable_auto_deploy').notNull().default(false),
  status: projectStatusEnum('status').notNull().default('pending'),
  lastDeployedAt: timestamp('last_deployed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const repoContracts = pgTable('repo_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  contractVersion: text('contract_version').notNull(),
  /** Le gamad.json brut validé (C-02). */
  rawContract: jsonb('raw_contract').notNull().$type<Record<string, unknown>>(),
  /** false → plan inféré par GitAdapter (C-03). */
  hasContract: boolean('has_contract').notNull(),
  analyzedAt: timestamp('analyzed_at', { withTimezone: true }).notNull().defaultNow(),
});
