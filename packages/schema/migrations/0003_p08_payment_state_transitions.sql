-- P-08 — Monétisation GeniusPay (ADR-0011)
-- (1) Supprime le trigger INSERT-only sur payment_transactions :
--     le statut doit être mutable pour l'idempotence financière (UPDATE WHERE pending).
--     L'audit est désormais assuré par payment_state_transitions (🔒 INSERT-only).
-- (2) Crée payment_state_transitions (table d'audit, C-11, INV-04).

-- (1) payment_transactions devient mutable (statut seulement)
DROP TRIGGER IF EXISTS tg_payment_transactions_insert_only ON payment_transactions;

-- (2) Table d'audit des transitions de statut
CREATE TABLE IF NOT EXISTS payment_state_transitions (
  id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID              NOT NULL REFERENCES payment_transactions(id),
  org_id         UUID              NOT NULL REFERENCES organizations(id),
  from_status    payment_status_enum,
  to_status      payment_status_enum NOT NULL,
  event_type     TEXT              NOT NULL,
  our_reference  TEXT              NOT NULL,
  provider_reference TEXT,
  payload_hash   TEXT              NOT NULL,
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- (2b) Trigger INSERT-only sur payment_state_transitions (INV-04, C-11)
DROP TRIGGER IF EXISTS tg_payment_state_transitions_insert_only ON payment_state_transitions;
CREATE TRIGGER tg_payment_state_transitions_insert_only
  BEFORE UPDATE OR DELETE ON payment_state_transitions
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();
