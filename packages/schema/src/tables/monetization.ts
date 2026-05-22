// docs/03 §3.6 — domaine MONÉTISATION (C-08, C-11)
// payment_transactions 🔒 et template_purchases 🔒 : INSERT-only (INV-04).
// org_id NOT NULL sur toutes les tables métier (INV-06).
// Devise XOF par défaut (contexte ivoirien, GeniusPay).

import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { paymentTypeEnum, paymentStatusEnum, subscriptionStatusEnum, templateLevelEnum } from '../enums';
import { organizations, users } from './identity';
import { plans } from './plans';

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  status: subscriptionStatusEnum('status').notNull().default('pending'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 🔒 Chaque transaction — payload_hash SHA-256 prouve l'intégrité (C-08, C-11, INV-04). */
export const paymentTransactions = pgTable('payment_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  type: paymentTypeEnum('type').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('XOF'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  provider: text('provider').notNull().default('geniuspay'),
  providerSessionId: text('provider_session_id'),
  /** Clé d'idempotence (INV-07) — une notification rejouée ne crée pas deux lignes. */
  reference: text('reference').notNull().unique(),
  payloadHash: text('payload_hash'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerOrgId: uuid('owner_org_id').references(() => organizations.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  repoUrl: text('repo_url').notNull(),
  contractHash: text('contract_hash'),
  marketplaceLevel: templateLevelEnum('marketplace_level').notNull().default('draft'),
  priceAmount: integer('price_amount').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 🔒 INSERT-only — un achat est un fait permanent (C-11, INV-04). */
export const templatePurchases = pgTable('template_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  templateId: uuid('template_id').notNull().references(() => templates.id),
  transactionId: uuid('transaction_id').references(() => paymentTransactions.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueOrgTemplate: unique('uq_template_purchases_org_template').on(t.orgId, t.templateId),
}));
