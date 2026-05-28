// docs/03 §3.2 — domaine IDENTITÉ & TENANT (C-10)
// Conventions : PK UUID gen_random_uuid() (INV-05), org_id NOT NULL sur tables métier (INV-06).
// Colonnes 🔑 : stockées chiffrées, jamais en clair.

import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { orgRoleEnum, platformRoleEnum } from '../enums';
import { plans } from './plans';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  /** 🔑 Jamais en clair — valeur bcrypt/argon2 chiffrée au repos. */
  passwordHash: text('password_hash').notNull(),
  /** NULL = actif, NOT NULL = suspendu (migration 0006). Vérifié dans TenantMiddleware. */
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  planId: uuid('plan_id').references(() => plans.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orgRole: orgRoleEnum('org_role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueOrgUser: unique('uq_org_members_org_user').on(t.orgId, t.userId),
}));

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Rôle plateforme — jamais exposé dans le JWT, lu en base à chaque requête (INV-06). */
  role: platformRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueUserRole: unique('uq_user_roles_user_role').on(t.userId, t.role),
}));
