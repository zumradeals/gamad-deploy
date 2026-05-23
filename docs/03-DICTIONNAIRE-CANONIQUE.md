# PIÈCE 3 — DICTIONNAIRE CANONIQUE

**GAMAD Deploy** · modèle de données v1.0 · PostgreSQL · 17 tables

---

## 3.0 — Conventions transversales (TOUTES les tables)

- **PK** : `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (INV-05).
- **Horodatage** : `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. `updated_at` uniquement sur les tables mutables.
- **Tenant** : `org_id UUID NOT NULL REFERENCES organizations(id)` sur toute table métier multi-tenant (INV-06).
- **Audit INSERT-only** : tables marquées 🔒 → trigger base refusant UPDATE/DELETE (INV-04, C-11).
- **Secrets** : jamais en clair. Colonnes marquées 🔑 → chiffrées au repos.
- **Nommage** : tables au pluriel `snake_case`, colonnes `snake_case`, enums PostgreSQL natifs.

---

## 3.1 — Vue d'ensemble (17 tables par domaine)

| Domaine | Tables |
|---|---|
| Identité & tenant (C-10) | `users`, `organizations`, `organization_members`, `user_roles` |
| Infrastructure (C-09, C-07) | `servers` |
| Projets & sources (C-02, C-03) | `projects`, `repo_contracts` |
| Déploiement (C-04, C-05) | `deployments`, `deployment_plans` 🔒, `deployment_logs` 🔒, `deployment_state_transitions` 🔒, `deployment_snapshots` |
| Monétisation (C-08) | `plans`, `subscriptions`, `payment_transactions` 🔒, `templates`, `template_purchases` 🔒 |

---

## 3.2 — Domaine IDENTITÉ & TENANT

### `users`
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| email | TEXT | NOT NULL, UNIQUE |
| full_name | TEXT | |
| password_hash | TEXT | NOT NULL 🔑 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### `organizations` (le tenant)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| slug | TEXT | NOT NULL, UNIQUE |
| plan_id | UUID | REFERENCES plans(id) |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### `organization_members` (appartenance + rôle org)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE |
| user_id | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| org_role | org_role_enum | NOT NULL DEFAULT 'member' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| | | UNIQUE (org_id, user_id) |

`org_role_enum` = `('owner', 'admin', 'member')`

### `user_roles` (rôles plateforme — séparés, jamais dans le JWT, INV-06)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| role | platform_role_enum | NOT NULL |
| | | UNIQUE (user_id, role) |

`platform_role_enum` = `('superadmin', 'support', 'user')`

---

## 3.3 — Domaine INFRASTRUCTURE

### `servers` (VPS du client — possédé ou provisionné)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | NOT NULL REFERENCES organizations(id) |
| name | TEXT | NOT NULL |
| host | TEXT | NOT NULL (IP/domaine) |
| agent_port | INTEGER | NOT NULL DEFAULT 7500 |
| agent_token | TEXT | NOT NULL, UNIQUE 🔑 (auth C-06) |
| provider | TEXT | NULL si serveur déjà possédé (C-09) |
| provider_server_id | TEXT | NULL |
| region | TEXT | |
| status | server_status_enum | NOT NULL DEFAULT 'provisioning' |
| agent_version | TEXT | |
| last_seen_at | TIMESTAMPTZ | (watchdog C-07) |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

`server_status_enum` = `('provisioning', 'installing', 'ready', 'error', 'destroyed')`

---

## 3.4 — Domaine PROJETS & SOURCES

### `projects`
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | NOT NULL REFERENCES organizations(id) |
| server_id | UUID | REFERENCES servers(id) |
| name | TEXT | NOT NULL |
| repo_url | TEXT | NOT NULL |
| repo_branch | TEXT | NOT NULL DEFAULT 'main' |
| git_token | TEXT | NULL 🔑 |
| domain | TEXT | |
| enable_https | BOOLEAN | NOT NULL DEFAULT true |
| enable_auto_deploy | BOOLEAN | NOT NULL DEFAULT false |
| status | project_status_enum | NOT NULL DEFAULT 'pending' |
| last_deployed_at | TIMESTAMPTZ | |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

`project_status_enum` = `('pending', 'deploying', 'live', 'failed', 'paused')`

### `repo_contracts` (cache du `gamad.json` analysé — C-02)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | NOT NULL REFERENCES projects(id) ON DELETE CASCADE |
| contract_version | TEXT | NOT NULL |
| raw_contract | JSONB | NOT NULL (le gamad.json brut) |
| has_contract | BOOLEAN | NOT NULL (false → inféré par adapter) |
| analyzed_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

---

## 3.5 — Domaine DÉPLOIEMENT

### `deployments`
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | NOT NULL REFERENCES projects(id) ON DELETE CASCADE |
| trigger_type | trigger_enum | NOT NULL (manual / webhook / auto) |
| trigger_user_id | UUID | REFERENCES users(id) |
| status | deployment_status_enum | NOT NULL DEFAULT 'pending' (C-04) |
| commit_sha | TEXT | |
| error_message | TEXT | |
| duration_seconds | INTEGER | |
| started_at, completed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

`deployment_status_enum` = `('pending', 'running', 'success', 'failed', 'rolled_back')`
`trigger_enum` = `('manual', 'webhook', 'auto')`

### `deployment_plans` 🔒 (le PDN figé — C-01, C-11)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| deployment_id | UUID | NOT NULL REFERENCES deployments(id) ON DELETE CASCADE |
| pdn_version | TEXT | NOT NULL |
| plan_hash | TEXT | NOT NULL (SHA-256 du plan) |
| source_type | TEXT | NOT NULL |
| source_url | TEXT | NOT NULL |
| source_ref | TEXT | |
| source_fingerprint | JSONB | NOT NULL DEFAULT '{}' |
| plan | JSONB | NOT NULL (le PDN complet) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| | | 🔒 trigger : no UPDATE/DELETE |

### `deployment_logs` 🔒 (chaque callback agent — C-06, C-11)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| deployment_id | UUID | NOT NULL REFERENCES deployments(id) ON DELETE CASCADE |
| step | TEXT | (resolve-source, provision-db…) |
| level | log_level_enum | NOT NULL DEFAULT 'info' |
| message | TEXT | NOT NULL |
| payload | JSONB | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| | | 🔒 trigger : no UPDATE/DELETE |

`log_level_enum` = `('info', 'warn', 'error', 'success')`

### `deployment_state_transitions` 🔒 (chaque transition — C-04, C-11)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| deployment_id | UUID | NOT NULL REFERENCES deployments(id) ON DELETE CASCADE |
| from_state | deployment_status_enum | (NULL pour création) |
| to_state | deployment_status_enum | NOT NULL |
| reason | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| | | 🔒 trigger : no UPDATE/DELETE |

### `deployment_snapshots` 🔒 (état pré-déploiement pour rollback — C-07, INV-08, C-11)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| deployment_id | UUID | NOT NULL REFERENCES deployments(id) ON DELETE CASCADE |
| compose_state | JSONB | (docker-compose + images figés) |
| nginx_config | TEXT | |
| commit_sha | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| | | 🔒 trigger : no UPDATE/DELETE |

*Write-once : un snapshot écrit une seule fois au démarrage du job dispatch-agent,
avant toute modification du serveur. Le fait « a servi au rollback » est dérivable
par jointure sur deployments.status = 'rolled_back' — aucun UPDATE n'est jamais requis.
Voir ADR-0004.*

---

## 3.6 — Domaine MONÉTISATION

### `plans` (offres d'abonnement)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| slug | TEXT | NOT NULL, UNIQUE |
| price_amount | INTEGER | NOT NULL (centimes) |
| currency | TEXT | NOT NULL DEFAULT 'XOF' |
| limits | JSONB | NOT NULL (max projets, serveurs, crédits…) |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

*Devise par défaut XOF (Franc CFA) — contexte ivoirien et GeniusPay.*

### `subscriptions`
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | NOT NULL REFERENCES organizations(id) |
| plan_id | UUID | NOT NULL REFERENCES plans(id) |
| status | subscription_status_enum | NOT NULL DEFAULT 'pending' |
| current_period_end | TIMESTAMPTZ | |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

`subscription_status_enum` = `('pending', 'active', 'past_due', 'cancelled')`
*L'abonnement appartient à l'organisation, pas à l'utilisateur (C-10).*

### `payment_transactions` 🔒 (C-08, C-11)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | NOT NULL REFERENCES organizations(id) |
| user_id | UUID | REFERENCES users(id) |
| type | payment_type_enum | NOT NULL |
| amount | INTEGER | NOT NULL (centimes) |
| currency | TEXT | NOT NULL DEFAULT 'XOF' |
| status | payment_status_enum | NOT NULL DEFAULT 'pending' |
| provider | TEXT | NOT NULL DEFAULT 'geniuspay' |
| provider_session_id | TEXT | |
| reference | TEXT | NOT NULL, UNIQUE (idempotence INV-07) |
| payload_hash | TEXT | (SHA-256 du payload vérifié) |
| metadata | JSONB | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| | | 🔒 trigger : no UPDATE/DELETE |

`payment_type_enum` = `('subscription', 'template_purchase', 'credits')`
`payment_status_enum` = `('pending', 'success', 'failed')`

### `templates` (marketplace)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| owner_org_id | UUID | REFERENCES organizations(id) |
| name | TEXT | NOT NULL |
| slug | TEXT | NOT NULL, UNIQUE |
| repo_url | TEXT | NOT NULL |
| contract_hash | TEXT | (SHA-256 du gamad.json certifié) |
| marketplace_level | template_level_enum | NOT NULL DEFAULT 'draft' |
| price_amount | INTEGER | NOT NULL DEFAULT 0 |
| is_published | BOOLEAN | NOT NULL DEFAULT false |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

`template_level_enum` = `('draft', 'valid', 'certified')` (certified = vendable, C-02)

### `template_purchases` 🔒 (C-11)
| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | NOT NULL REFERENCES organizations(id) |
| template_id | UUID | NOT NULL REFERENCES templates(id) |
| transaction_id | UUID | REFERENCES payment_transactions(id) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| | | UNIQUE (org_id, template_id) · 🔒 no UPDATE/DELETE |

---

## 3.7 — Note sur les crédits IA (phase ultérieure)

L'ancien projet avait `ai_credits` + `ai_credit_transactions` (génération IA de
templates). Volontairement écartés du MVP : cette fonctionnalité est secondaire au
cœur métier « déployer un repo ». Le `payment_type_enum` prévoit déjà `'credits'` :
ces deux tables pourront être ajoutées en phase ultérieure **sans casser le schéma**.

---

## 3.8 — Récapitulatif des invariants appliqués

- **17 tables**, UUID v4 partout (INV-05).
- **6 tables d'audit** verrouillées au niveau base : `deployment_plans`, `deployment_logs`, `deployment_state_transitions`, `deployment_snapshots`, `payment_transactions`, `template_purchases` (INV-04). Voir ADR-0004.
- **Tenant injecté** : `org_id` sur toute table métier (INV-06).
- **Monétisation rattachée à l'organisation**, jamais à l'utilisateur seul.
- **Devise XOF** par défaut (contexte africain).
