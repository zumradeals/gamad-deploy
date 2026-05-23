// docs/03 §3.5 — domaine DÉPLOIEMENT (C-04, C-05, C-06, C-07, C-11)
// Tables marquées 🔒 : INSERT-only, trigger refuse_audit_mutation() appliqué (INV-04).
// deployment_snapshots 🔒 : write-once au démarrage de dispatch-agent (ADR-0004).

import { pgTable, uuid, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { deploymentStatusEnum, triggerTypeEnum, logLevelEnum } from '../enums';
import { users } from './identity';
import { projects } from './projects';

export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  triggerType: triggerTypeEnum('trigger_type').notNull(),
  triggerUserId: uuid('trigger_user_id').references(() => users.id),
  status: deploymentStatusEnum('status').notNull().default('pending'),
  commitSha: text('commit_sha'),
  errorMessage: text('error_message'),
  durationSeconds: integer('duration_seconds'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 🔒 Le PDN figé avant exécution — SHA-256 prouve l'intégrité (C-01, C-11, INV-04). */
export const deploymentPlans = pgTable('deployment_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  pdnVersion: text('pdn_version').notNull(),
  planHash: text('plan_hash').notNull(),
  sourceType: text('source_type').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceRef: text('source_ref'),
  sourceFingerprint: jsonb('source_fingerprint').notNull().$type<Record<string, unknown>>().default({}),
  plan: jsonb('plan').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 🔒 Chaque callback agent — append séquentiel (C-06, C-11, INV-04). */
export const deploymentLogs = pgTable('deployment_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  step: text('step'),
  level: logLevelEnum('level').notNull().default('info'),
  message: text('message').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 🔒 Chaque transition d'état — jamais écrasée (C-04, C-11, INV-04). */
export const deploymentStateTransitions = pgTable('deployment_state_transitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  /** NULL pour la première transition (création). */
  fromState: deploymentStatusEnum('from_state'),
  toState: deploymentStatusEnum('to_state').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 🔒 État pré-déploiement pour rollback — write-once (C-07, INV-08, ADR-0004). */
export const deploymentSnapshots = pgTable('deployment_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  composeState: jsonb('compose_state').$type<Record<string, unknown>>(),
  nginxConfig: text('nginx_config'),
  commitSha: text('commit_sha'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
