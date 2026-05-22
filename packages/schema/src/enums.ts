// Enums PostgreSQL natifs — transcription fidèle de docs/03-DICTIONNAIRE-CANONIQUE.md §3.0
// Nommage : snake_case, pluriel pour les tables, valeurs littérales identiques à la spec.

import { pgEnum } from 'drizzle-orm/pg-core';

export const orgRoleEnum = pgEnum('org_role_enum', ['owner', 'admin', 'member']);
export const platformRoleEnum = pgEnum('platform_role_enum', ['superadmin', 'support', 'user']);
export const serverStatusEnum = pgEnum('server_status_enum', ['provisioning', 'installing', 'ready', 'error', 'destroyed']);
export const projectStatusEnum = pgEnum('project_status_enum', ['pending', 'deploying', 'live', 'failed', 'paused']);
export const deploymentStatusEnum = pgEnum('deployment_status_enum', ['pending', 'running', 'success', 'failed', 'rolled_back']);
export const triggerTypeEnum = pgEnum('trigger_enum', ['manual', 'webhook', 'auto']);
export const logLevelEnum = pgEnum('log_level_enum', ['info', 'warn', 'error', 'success']);
export const paymentTypeEnum = pgEnum('payment_type_enum', ['subscription', 'template_purchase', 'credits']);
export const paymentStatusEnum = pgEnum('payment_status_enum', ['pending', 'success', 'failed']);
export const subscriptionStatusEnum = pgEnum('subscription_status_enum', ['pending', 'active', 'past_due', 'cancelled']);
export const templateLevelEnum = pgEnum('template_level_enum', ['draft', 'valid', 'certified']);
