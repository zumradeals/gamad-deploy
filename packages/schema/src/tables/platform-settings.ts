// platform_settings — configuration clé/valeur typée de la plateforme (superadmin)
// Catégories : branding | auth | features | limits | maintenance
// INV-05 : UUID v4, INV-04 : pas de DELETE hors superadmin.

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './identity';

export const platformSettings = pgTable('platform_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  /** 'string' | 'boolean' | 'number' | 'json' */
  valueType: text('value_type').notNull().default('string'),
  /** 'branding' | 'auth' | 'features' | 'limits' | 'maintenance' */
  category: text('category').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
