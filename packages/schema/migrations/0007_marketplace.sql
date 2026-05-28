-- Migration 0007 — Marketplace : colonnes templates étendues
-- Ajoute description, tags et contract_content sur la table templates.
-- contract_content : contenu brut du gamad.json certifié, stocké à la soumission,
-- permet de déployer sans re-cloner le dépôt (INV-02, INV-07).

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS description      TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags             TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contract_content TEXT        DEFAULT NULL;
