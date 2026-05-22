-- INV-04 : les 6 tables d'audit sont INSERT-only.
-- Tout UPDATE ou DELETE déclenche une exception immédiate avec le code INV-04.

CREATE OR REPLACE FUNCTION refuse_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'INV-04 : cette table est INSERT-only. Toute mutation (UPDATE/DELETE) est interdite.';
END;
$$ LANGUAGE plpgsql;

-- deployment_plans
CREATE TRIGGER tg_deployment_plans_insert_only
  BEFORE UPDATE OR DELETE ON deployment_plans
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();

-- deployment_logs
CREATE TRIGGER tg_deployment_logs_insert_only
  BEFORE UPDATE OR DELETE ON deployment_logs
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();

-- deployment_state_transitions
CREATE TRIGGER tg_deployment_state_transitions_insert_only
  BEFORE UPDATE OR DELETE ON deployment_state_transitions
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();

-- deployment_snapshots (ADR-0004 : write-once)
CREATE TRIGGER tg_deployment_snapshots_insert_only
  BEFORE UPDATE OR DELETE ON deployment_snapshots
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();

-- payment_transactions
CREATE TRIGGER tg_payment_transactions_insert_only
  BEFORE UPDATE OR DELETE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();

-- template_purchases
CREATE TRIGGER tg_template_purchases_insert_only
  BEFORE UPDATE OR DELETE ON template_purchases
  FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();
