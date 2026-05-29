// docs/03 §3.7 — domaine STUDIO (feat/reference-templates)
// template_revisions et template_certifications : INSERT-only (INV-04).
// orgId injecté côté serveur via JWT (INV-06).
// contentHash SHA-256 sur chaque révision (INV-04).

import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { blueprintStatusEnum, templateCategoryEnum, certificationDecisionEnum } from '../enums';
import { organizations, users } from './identity';
import { templates } from './monetization';

export const templateBlueprints = pgTable('template_blueprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  tags: text('tags').array().notNull().default([]),
  category: templateCategoryEnum('category').notNull(),
  isComposed: boolean('is_composed').notNull().default(false),
  status: blueprintStatusEnum('status').notNull().default('draft'),
  latestRevisionId: uuid('latest_revision_id'),
  certifiedTemplateId: uuid('certified_template_id').references(() => templates.id),
  repoUrl: text('repo_url'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 🔒 INSERT-only — snapshot immuable du gamad.json (INV-04). */
export const templateRevisions = pgTable('template_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  blueprintId: uuid('blueprint_id').notNull().references(() => templateBlueprints.id),
  version: integer('version').notNull(),
  contractContent: text('contract_content').notNull(),
  /** SHA-256 du contractContent — preuve d'intégrité (INV-04). */
  contentHash: text('content_hash').notNull(),
  authorId: uuid('author_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueBlueprintVersion: unique('uq_template_revisions_blueprint_version').on(t.blueprintId, t.version),
}));

export const templateComponents = pgTable('template_components', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentBlueprintId: uuid('parent_blueprint_id').notNull().references(() => templateBlueprints.id),
  componentTemplateId: uuid('component_template_id').notNull().references(() => templates.id),
  order: integer('order').notNull().default(0),
  /** Surcharges de variables d'environnement ou de ports pour ce composant. */
  configOverrides: jsonb('config_overrides').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueParentComponent: unique('uq_template_components_parent_component').on(t.parentBlueprintId, t.componentTemplateId),
}));

/** 🔒 INSERT-only — audit trail de certification (INV-04). */
export const templateCertifications = pgTable('template_certifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  blueprintId: uuid('blueprint_id').notNull().references(() => templateBlueprints.id),
  revisionId: uuid('revision_id').notNull().references(() => templateRevisions.id),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  decision: certificationDecisionEnum('decision').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
