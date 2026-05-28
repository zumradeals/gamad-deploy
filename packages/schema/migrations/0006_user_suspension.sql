-- Migration 0006 — suspension des comptes utilisateurs
-- Ajoute une colonne suspended_at TIMESTAMPTZ sur users.
-- NULL = compte actif, NOT NULL = compte suspendu.
-- Pas de DELETE réel : l'état est porté par la colonne (INV-04 esprit).

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
