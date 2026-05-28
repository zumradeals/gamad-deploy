-- Migration 0005 : table platform_settings + valeurs par défaut
-- Superadmin dashboard Phase 1

CREATE TABLE IF NOT EXISTS platform_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  value_type  TEXT NOT NULL DEFAULT 'string',
  category    TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id)
);

-- Valeurs par défaut de la plateforme
INSERT INTO platform_settings (key, value, value_type, category) VALUES
  ('platform_name',        'GAMAD Deploy',        'string',  'branding'),
  ('tagline',              'Déployez sans DevOps', 'string',  'branding'),
  ('primary_color',        '#10B981',             'string',  'branding'),
  ('secondary_color',      '#6366F1',             'string',  'branding'),
  ('logo_url',             '',                    'string',  'branding'),
  ('favicon_url',          '',                    'string',  'branding'),
  ('allow_registration',   'true',                'boolean', 'auth'),
  ('templates_enabled',    'true',                'boolean', 'features'),
  ('billing_enabled',      'true',                'boolean', 'features'),
  ('auto_deploy_enabled',  'true',                'boolean', 'features'),
  ('default_max_projects', '5',                   'number',  'limits'),
  ('default_max_servers',  '3',                   'number',  'limits'),
  ('maintenance_mode',     'false',               'boolean', 'maintenance'),
  ('maintenance_message',  '',                    'string',  'maintenance')
ON CONFLICT (key) DO NOTHING;
