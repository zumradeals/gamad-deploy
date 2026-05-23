// docs/03 §3.3 — domaine INFRASTRUCTURE (C-09, C-07)
// servers : VPS du client — possédé par le client ou provisionné automatiquement.
// org_id NOT NULL (INV-06). agent_token 🔑 chiffré au repos.

import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { serverStatusEnum } from '../enums';
import { organizations } from './identity';

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  host: text('host').notNull(),
  agentPort: integer('agent_port').notNull().default(7500),
  /** 🔑 Jeton d'authentification agent — chiffré au repos, jamais loggé. */
  agentToken: text('agent_token').notNull().unique(),
  /** NULL si serveur déjà possédé par le client (souveraineté, C-09). */
  provider: text('provider'),
  providerServerId: text('provider_server_id'),
  region: text('region'),
  status: serverStatusEnum('status').notNull().default('provisioning'),
  agentVersion: text('agent_version'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
