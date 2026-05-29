-- Migration 0010 — Corriger les repo_url des templates de référence GAMAD Officiel
-- Les repos ont été créés sur https://github.com/zumradeals/gamad-template-*
-- et les source_ref pointent maintenant sur la branche "cursor".

UPDATE templates SET
  repo_url = 'https://github.com/zumradeals/gamad-template-nodejs-api',
  contract_content = jsonb_set(
    contract_content::jsonb,
    '{source_ref}',
    '{"type":"branch","value":"cursor"}'::jsonb
  )::text,
  updated_at = now()
WHERE slug = 'gamad-nodejs-api';

UPDATE templates SET
  repo_url = 'https://github.com/zumradeals/gamad-template-wordpress',
  contract_content = jsonb_set(
    contract_content::jsonb,
    '{source_ref}',
    '{"type":"branch","value":"cursor"}'::jsonb
  )::text,
  updated_at = now()
WHERE slug = 'gamad-wordpress';

UPDATE templates SET
  repo_url = 'https://github.com/zumradeals/gamad-template-laravel',
  contract_content = jsonb_set(
    contract_content::jsonb,
    '{source_ref}',
    '{"type":"branch","value":"cursor"}'::jsonb
  )::text,
  updated_at = now()
WHERE slug = 'gamad-laravel';

UPDATE templates SET
  repo_url = 'https://github.com/zumradeals/gamad-template-django',
  contract_content = jsonb_set(
    contract_content::jsonb,
    '{source_ref}',
    '{"type":"branch","value":"cursor"}'::jsonb
  )::text,
  updated_at = now()
WHERE slug = 'gamad-django';

UPDATE templates SET
  repo_url = 'https://github.com/zumradeals/gamad-template-nextjs-fullstack',
  contract_content = jsonb_set(
    contract_content::jsonb,
    '{source_ref}',
    '{"type":"branch","value":"cursor"}'::jsonb
  )::text,
  updated_at = now()
WHERE slug = 'gamad-nextjs-fullstack';

UPDATE templates SET
  repo_url = 'https://github.com/zumradeals/gamad-template-lemp-stack',
  contract_content = jsonb_set(
    contract_content::jsonb,
    '{source_ref}',
    '{"type":"branch","value":"cursor"}'::jsonb
  )::text,
  updated_at = now()
WHERE slug = 'gamad-lemp-stack';
