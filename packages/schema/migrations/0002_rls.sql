-- P-01.5 : Row-Level Security sur toutes les tables métier portant org_id (INV-06, ADR-0005).
--
-- Mécanisme : chaque transaction applicative pose set_config('app.current_org_id', orgId, true)
-- via withTenantTx(). La valeur est locale à la transaction (is_local = true) → reset
-- automatique au COMMIT/ROLLBACK → aucune fuite entre connexions poolées.
--
-- NULLIF(..., '') protège contre un setting vide ('') qui ferait échouer le cast ::uuid.
-- Si non configuré : current_setting retourne NULL → org_id = NULL → false → deny-by-default.
--
-- FORCE ROW LEVEL SECURITY est nécessaire car le rôle "gamad" est propriétaire des tables
-- et contourne RLS par défaut. FORCE le réactive pour tous les rôles sans exception.

CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

-- ── organization_members ─────────────────────────────────────────────────────
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization_members
  USING (org_id = current_org_id());

-- ── servers ──────────────────────────────────────────────────────────────────
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON servers
  USING (org_id = current_org_id());

-- ── projects ─────────────────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (org_id = current_org_id());

-- ── deployments (org_id indirect via project_id → projects) ──────────────────
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON deployments
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE org_id = current_org_id()
    )
  );

-- ── subscriptions ────────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON subscriptions
  USING (org_id = current_org_id());

-- ── payment_transactions (table d'audit + tenant) ────────────────────────────
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_transactions
  USING (org_id = current_org_id());

-- ── template_purchases (table d'audit + tenant) ──────────────────────────────
ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_purchases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON template_purchases
  USING (org_id = current_org_id());

-- ── templates (owner_org_id nullable : NULL = template GAMAD visible par tous) ──
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON templates
  USING (
    owner_org_id IS NULL
    OR owner_org_id = current_org_id()
  );
