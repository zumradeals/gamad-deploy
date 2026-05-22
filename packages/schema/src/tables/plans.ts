// plans — défini en premier car référencé par organizations (pas de dépendance externe)
// docs/03 §3.6 — domaine MONÉTISATION (isolé ici pour éviter la dépendance circulaire
// identity ↔ monetization via organizations.plan_id).

import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  priceAmount: integer('price_amount').notNull(),
  currency: text('currency').notNull().default('XOF'),
  limits: jsonb('limits').notNull().$type<Record<string, unknown>>(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
