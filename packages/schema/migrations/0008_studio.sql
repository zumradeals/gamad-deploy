-- Migration 0008 — GAMAD Studio
-- Crée les 4 tables du Studio : template_blueprints, template_revisions,
-- template_components, template_certifications.
-- template_revisions et template_certifications : INSERT-only (INV-04).
-- Insère les 6 templates de référence GAMAD Officiel (owner_org_id = NULL).

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "public"."blueprint_status_enum" AS ENUM(
  'draft', 'submitted', 'under_review', 'certified', 'rejected'
);--> statement-breakpoint

CREATE TYPE "public"."template_category_enum" AS ENUM(
  'web_app', 'cms', 'ecommerce', 'stack', 'data_tools', 'devops'
);--> statement-breakpoint

CREATE TYPE "public"."certification_decision_enum" AS ENUM(
  'approved', 'rejected'
);--> statement-breakpoint

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE "template_blueprints" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id"                uuid NOT NULL REFERENCES "organizations"("id"),
  "name"                  text NOT NULL,
  "description"           text NOT NULL DEFAULT '',
  "tags"                  text[] NOT NULL DEFAULT '{}',
  "category"              "template_category_enum" NOT NULL,
  "is_composed"           boolean NOT NULL DEFAULT false,
  "status"                "blueprint_status_enum" NOT NULL DEFAULT 'draft',
  "latest_revision_id"    uuid,
  "certified_template_id" uuid REFERENCES "templates"("id"),
  "repo_url"              text,
  "created_by"            uuid NOT NULL REFERENCES "users"("id"),
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "template_revisions" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "blueprint_id"     uuid NOT NULL REFERENCES "template_blueprints"("id"),
  "version"          integer NOT NULL,
  "contract_content" text NOT NULL,
  "content_hash"     text NOT NULL,
  "author_id"        uuid NOT NULL REFERENCES "users"("id"),
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_template_revisions_blueprint_version" UNIQUE("blueprint_id", "version")
);--> statement-breakpoint

CREATE TABLE "template_components" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_blueprint_id"   uuid NOT NULL REFERENCES "template_blueprints"("id"),
  "component_template_id" uuid NOT NULL REFERENCES "templates"("id"),
  "order"                 integer NOT NULL DEFAULT 0,
  "config_overrides"      jsonb,
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_template_components_parent_component" UNIQUE("parent_blueprint_id", "component_template_id")
);--> statement-breakpoint

CREATE TABLE "template_certifications" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "blueprint_id" uuid NOT NULL REFERENCES "template_blueprints"("id"),
  "revision_id"  uuid NOT NULL REFERENCES "template_revisions"("id"),
  "reviewer_id"  uuid REFERENCES "users"("id"),
  "decision"     "certification_decision_enum" NOT NULL,
  "comment"      text,
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── INSERT-only triggers (INV-04) ─────────────────────────────────────────────

CREATE TRIGGER tg_template_revisions_insert_only
  BEFORE UPDATE OR DELETE ON template_revisions
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();--> statement-breakpoint

CREATE TRIGGER tg_template_certifications_insert_only
  BEFORE UPDATE OR DELETE ON template_certifications
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();--> statement-breakpoint

-- ── Seeds — 6 Templates de référence GAMAD Officiel ──────────────────────────
-- owner_org_id = NULL → GAMAD Officiel (INV-05 : UUIDs v4 figés).
-- marketplace_level = 'certified', is_published = true.
-- contract_content : gamad.json valide (C-02).

INSERT INTO templates (
  id, owner_org_id, name, slug, repo_url, contract_hash,
  marketplace_level, price_amount, is_published,
  description, tags, contract_content,
  created_at, updated_at
) VALUES

-- 1. Node.js API (gratuit, catégorie web_app)
(
  'a1b2c3d4-e5f6-7890-abcd-000000000001',
  NULL,
  'Node.js API',
  'gamad-nodejs-api',
  'https://github.com/gamad-deploy/template-nodejs-api',
  NULL,
  'certified', 0, true,
  'Template de référence pour une API Node.js avec Docker Compose. Inclut health check, gestion des variables d''environnement et support PostgreSQL.',
  ARRAY['nodejs', 'api', 'docker', 'web_app'],
  '{
  "contract_version": "1.0",
  "name": "gamad-nodejs-api",
  "artifact_type": "docker-compose",
  "source_ref": { "type": "branch", "value": "main" },
  "runtime": {
    "compose_file": "docker-compose.yml",
    "ports": { "app": 3000 }
  },
  "env": [
    { "name": "NODE_ENV",     "required": true,  "secret": false, "default": "production" },
    { "name": "PORT",         "required": false, "secret": false, "default": "3000" },
    { "name": "DATABASE_URL", "required": false, "secret": true  }
  ],
  "health": {
    "checks": [
      { "name": "api", "path": "/health", "expected_status": 200, "timeout_s": 30 }
    ]
  },
  "policies": { "ban_latest": true, "on_error_stop": true }
}',
  NOW(), NOW()
),

-- 2. Laravel (gratuit, catégorie web_app)
(
  'a1b2c3d4-e5f6-7890-abcd-000000000002',
  NULL,
  'Laravel App',
  'gamad-laravel',
  'https://github.com/gamad-deploy/template-laravel',
  NULL,
  'certified', 0, true,
  'Template de référence pour une application Laravel avec Nginx, PHP-FPM et MySQL. Prêt pour la production.',
  ARRAY['laravel', 'php', 'mysql', 'nginx', 'web_app'],
  '{
  "contract_version": "1.0",
  "name": "gamad-laravel",
  "artifact_type": "docker-compose",
  "source_ref": { "type": "branch", "value": "main" },
  "runtime": {
    "compose_file": "docker-compose.yml",
    "ports": { "app": 80 }
  },
  "env": [
    { "name": "APP_ENV",      "required": true,  "secret": false, "default": "production" },
    { "name": "APP_KEY",      "required": true,  "secret": true  },
    { "name": "DB_HOST",      "required": true,  "secret": false, "default": "db" },
    { "name": "DB_DATABASE",  "required": true,  "secret": false },
    { "name": "DB_USERNAME",  "required": true,  "secret": true  },
    { "name": "DB_PASSWORD",  "required": true,  "secret": true  }
  ],
  "health": {
    "checks": [
      { "name": "web", "path": "/", "expected_status": 200, "timeout_s": 60 }
    ]
  },
  "policies": { "ban_latest": true, "on_error_stop": true }
}',
  NOW(), NOW()
),

-- 3. WordPress (gratuit, catégorie cms)
(
  'a1b2c3d4-e5f6-7890-abcd-000000000003',
  NULL,
  'WordPress',
  'gamad-wordpress',
  'https://github.com/gamad-deploy/template-wordpress',
  NULL,
  'certified', 0, true,
  'Template de référence WordPress avec MySQL. Déployez un CMS complet en quelques minutes sur votre serveur.',
  ARRAY['wordpress', 'cms', 'mysql', 'php'],
  '{
  "contract_version": "1.0",
  "name": "gamad-wordpress",
  "artifact_type": "docker-compose",
  "source_ref": { "type": "branch", "value": "main" },
  "runtime": {
    "compose_file": "docker-compose.yml",
    "ports": { "app": 80 }
  },
  "env": [
    { "name": "WORDPRESS_DB_HOST",     "required": true,  "secret": false, "default": "db" },
    { "name": "WORDPRESS_DB_NAME",     "required": true,  "secret": false, "default": "wordpress" },
    { "name": "WORDPRESS_DB_USER",     "required": true,  "secret": true  },
    { "name": "WORDPRESS_DB_PASSWORD", "required": true,  "secret": true  },
    { "name": "MYSQL_ROOT_PASSWORD",   "required": true,  "secret": true  }
  ],
  "health": {
    "checks": [
      { "name": "web", "path": "/wp-login.php", "expected_status": 200, "timeout_s": 60 }
    ]
  },
  "policies": { "ban_latest": false, "on_error_stop": true }
}',
  NOW(), NOW()
),

-- 4. Django + PostgreSQL (gratuit, catégorie web_app)
(
  'a1b2c3d4-e5f6-7890-abcd-000000000004',
  NULL,
  'Django + PostgreSQL',
  'gamad-django',
  'https://github.com/gamad-deploy/template-django',
  NULL,
  'certified', 0, true,
  'Template de référence Django avec PostgreSQL et Gunicorn. Architecture production-ready avec gestion des migrations.',
  ARRAY['django', 'python', 'postgresql', 'gunicorn', 'web_app'],
  '{
  "contract_version": "1.0",
  "name": "gamad-django",
  "artifact_type": "docker-compose",
  "source_ref": { "type": "branch", "value": "main" },
  "runtime": {
    "compose_file": "docker-compose.yml",
    "ports": { "app": 8000 }
  },
  "env": [
    { "name": "DEBUG",        "required": false, "secret": false, "default": "0" },
    { "name": "SECRET_KEY",   "required": true,  "secret": true  },
    { "name": "ALLOWED_HOSTS","required": true,  "secret": false },
    { "name": "DATABASE_URL", "required": true,  "secret": true  }
  ],
  "health": {
    "checks": [
      { "name": "api", "path": "/health/", "expected_status": 200, "timeout_s": 30 }
    ]
  },
  "policies": { "ban_latest": true, "on_error_stop": true }
}',
  NOW(), NOW()
),

-- 5. Next.js Full-Stack (payant 2500 XOF, catégorie web_app)
(
  'a1b2c3d4-e5f6-7890-abcd-000000000005',
  NULL,
  'Next.js Full-Stack',
  'gamad-nextjs-fullstack',
  'https://github.com/gamad-deploy/template-nextjs-fullstack',
  NULL,
  'certified', 2500, true,
  'Template premium Next.js 14 avec App Router, NextAuth, PostgreSQL et Prisma. Inclut double health check (web + base de données).',
  ARRAY['nextjs', 'react', 'typescript', 'postgresql', 'prisma', 'web_app'],
  '{
  "contract_version": "1.0",
  "name": "gamad-nextjs-fullstack",
  "artifact_type": "docker-compose",
  "source_ref": { "type": "branch", "value": "main" },
  "runtime": {
    "compose_file": "docker-compose.yml",
    "ports": { "app": 3000 }
  },
  "env": [
    { "name": "NODE_ENV",            "required": true,  "secret": false, "default": "production" },
    { "name": "NEXTAUTH_URL",        "required": true,  "secret": false },
    { "name": "NEXTAUTH_SECRET",     "required": true,  "secret": true  },
    { "name": "DATABASE_URL",        "required": true,  "secret": true  },
    { "name": "NEXT_PUBLIC_APP_URL", "required": false, "secret": false }
  ],
  "health": {
    "checks": [
      { "name": "web", "path": "/api/health",    "expected_status": 200, "timeout_s": 30 },
      { "name": "db",  "path": "/api/health/db", "expected_status": 200, "timeout_s": 15 }
    ]
  },
  "policies": { "ban_latest": true, "on_error_stop": true }
}',
  NOW(), NOW()
),

-- 6. Stack LEMP (gratuit, catégorie stack)
(
  'a1b2c3d4-e5f6-7890-abcd-000000000006',
  NULL,
  'Stack LEMP',
  'gamad-lemp-stack',
  'https://github.com/gamad-deploy/template-lemp-stack',
  NULL,
  'certified', 0, true,
  'Stack complète Linux + Nginx + MySQL + PHP-FPM. Template de base pour déployer des applications PHP sur votre VPS.',
  ARRAY['lemp', 'nginx', 'mysql', 'php', 'stack'],
  '{
  "contract_version": "1.0",
  "name": "gamad-lemp-stack",
  "artifact_type": "docker-compose",
  "source_ref": { "type": "branch", "value": "main" },
  "runtime": {
    "compose_file": "docker-compose.yml",
    "ports": { "nginx": 80, "app": 9000 }
  },
  "env": [
    { "name": "MYSQL_ROOT_PASSWORD", "required": true,  "secret": true  },
    { "name": "MYSQL_DATABASE",      "required": true,  "secret": false, "default": "app" },
    { "name": "MYSQL_USER",          "required": true,  "secret": true  },
    { "name": "MYSQL_PASSWORD",      "required": true,  "secret": true  }
  ],
  "health": {
    "checks": [
      { "name": "nginx", "path": "/", "expected_status": 200, "timeout_s": 30 }
    ]
  },
  "policies": { "ban_latest": false, "on_error_stop": true }
}',
  NOW(), NOW()
)

ON CONFLICT (slug) DO NOTHING;
