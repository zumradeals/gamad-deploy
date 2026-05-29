-- Migration 0009 — Table ai_generation_logs
-- INSERT-only (INV-04) : log de chaque appel IA pour audit et facturation future.
-- orgId NOT NULL (INV-06).

CREATE TABLE IF NOT EXISTS "ai_generation_logs" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"       uuid NOT NULL REFERENCES "organizations"("id"),
  "user_id"      uuid NOT NULL REFERENCES "users"("id"),
  "blueprint_id" uuid REFERENCES "template_blueprints"("id"),
  "prompt"       text NOT NULL,
  "model_id"     text NOT NULL,
  "tokens_input"  integer NOT NULL DEFAULT 0,
  "tokens_output" integer NOT NULL DEFAULT 0,
  "credit_cost"  integer NOT NULL DEFAULT 0,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

-- Aucun UPDATE/DELETE autorisé — politique INSERT-only (INV-04).
-- Trigger de protection :
CREATE OR REPLACE FUNCTION prevent_ai_generation_logs_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ai_generation_logs is INSERT-only (INV-04)';
END;
$$;

CREATE TRIGGER trg_ai_generation_logs_no_update
  BEFORE UPDATE ON "ai_generation_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_ai_generation_logs_mutation();

CREATE TRIGGER trg_ai_generation_logs_no_delete
  BEFORE DELETE ON "ai_generation_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_ai_generation_logs_mutation();
