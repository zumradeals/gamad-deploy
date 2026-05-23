// Test (a) — INV-04 : les 6 tables d'audit refusent tout UPDATE et DELETE.
// Chaque test insère des données réelles et tente une mutation → doit être rejeté.
// Utilise des SAVEPOINTs pour récupérer la transaction après l'exception attendue.

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { createTestPool, applyMigrations } from './helpers/setup';

describe('Audit immutability (INV-04) — les 6 tables 🔒', () => {
  let pool: Pool;
  let client: PoolClient;

  // IDs de données de setup réutilisés par tous les tests
  let orgId: string;
  let userId: string;
  let serverId: string;
  let projectId: string;
  let deploymentId: string;
  let templateId: string;
  let transactionId: string;

  beforeAll(async () => {
    pool = await createTestPool();
    await applyMigrations(pool);
    client = await pool.connect();

    await client.query('BEGIN');

    // Setup minimal : plan → user → org → server → project → deployment
    const planRes = await client.query<{ id: string }>(
      `INSERT INTO plans (name, slug, price_amount, limits)
       VALUES ('Test Plan', 'test-plan-${Date.now()}', 0, '{}') RETURNING id`,
    );
    const planId = planRes.rows[0]!.id;

    const userRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash)
       VALUES ('test-audit-${Date.now()}@gamad.test', '$2b$10$placeholder') RETURNING id`,
    );
    userId = userRes.rows[0]!.id;

    const orgRes = await client.query<{ id: string }>(
      `INSERT INTO organizations (name, slug, plan_id)
       VALUES ('Audit Org', 'audit-org-${Date.now()}', $1) RETURNING id`,
      [planId],
    );
    orgId = orgRes.rows[0]!.id;

    // Pose le contexte tenant LOCAL à cette transaction (is_local = true).
    // Requis pour que les INSERTs sur les tables avec RLS (servers, projects, etc.)
    // passent le WITH CHECK implicitement copié de la policy USING.
    await client.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgId]);

    const serverRes = await client.query<{ id: string }>(
      `INSERT INTO servers (org_id, name, host, agent_token)
       VALUES ($1, 'test-server', '10.0.0.1', 'tok-${Date.now()}') RETURNING id`,
      [orgId],
    );
    serverId = serverRes.rows[0]!.id;

    const projectRes = await client.query<{ id: string }>(
      `INSERT INTO projects (org_id, server_id, name, repo_url)
       VALUES ($1, $2, 'Test Project', 'https://github.com/test/test') RETURNING id`,
      [orgId, serverId],
    );
    projectId = projectRes.rows[0]!.id;

    const deployRes = await client.query<{ id: string }>(
      `INSERT INTO deployments (project_id, trigger_type, status)
       VALUES ($1, 'manual', 'running') RETURNING id`,
      [projectId],
    );
    deploymentId = deployRes.rows[0]!.id;

    const tplRes = await client.query<{ id: string }>(
      `INSERT INTO templates (owner_org_id, name, slug, repo_url)
       VALUES ($1, 'Test Template', 'test-tpl-${Date.now()}', 'https://github.com/test/tpl') RETURNING id`,
      [orgId],
    );
    templateId = tplRes.rows[0]!.id;

    const txRes = await client.query<{ id: string }>(
      `INSERT INTO payment_transactions (org_id, user_id, type, amount, reference)
       VALUES ($1, $2, 'subscription', 0, 'ref-setup-${Date.now()}') RETURNING id`,
      [orgId, userId],
    );
    transactionId = txRes.rows[0]!.id;

    await client.query('COMMIT');
  });

  afterAll(async () => {
    client.release();
    await pool.end();
  });

  /** Exécute une requête dans un SAVEPOINT pour récupérer après l'exception attendue.
   *  set_config pose app.current_org_id en LOCAL pour que les tables avec RLS (ex.
   *  payment_transactions, template_purchases) laissent la row visible et que le
   *  trigger INV-04 soit atteint — sans quoi RLS masquerait la row avant le trigger. */
  async function expectAuditViolation(sql: string, params: unknown[] = []): Promise<void> {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgId]);
    await client.query('SAVEPOINT before_violation');
    await expect(client.query(sql, params)).rejects.toThrow(/INSERT-only|INV-04/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
    await client.query('ROLLBACK');
  }

  // ─── deployment_plans ────────────────────────────────────────────────────────

  test('deployment_plans — UPDATE rejeté (INV-04)', async () => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO deployment_plans
         (deployment_id, pdn_version, plan_hash, source_type, source_url, source_fingerprint, plan)
       VALUES ($1, '1.0', 'sha256-abc', 'git', 'https://github.com/test/test', '{}', '{}')
       RETURNING id`,
      [deploymentId],
    );
    const id = res.rows[0]!.id;
    await expectAuditViolation(
      `UPDATE deployment_plans SET pdn_version = 'tampered' WHERE id = $1`,
      [id],
    );
  });

  test('deployment_plans — DELETE rejeté (INV-04)', async () => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO deployment_plans
         (deployment_id, pdn_version, plan_hash, source_type, source_url, source_fingerprint, plan)
       VALUES ($1, '1.0', 'sha256-def', 'git', 'https://github.com/test/test', '{}', '{}')
       RETURNING id`,
      [deploymentId],
    );
    const id = res.rows[0]!.id;
    await expectAuditViolation(`DELETE FROM deployment_plans WHERE id = $1`, [id]);
  });

  // ─── deployment_logs ─────────────────────────────────────────────────────────

  test('deployment_logs — UPDATE rejeté (INV-04)', async () => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO deployment_logs (deployment_id, message)
       VALUES ($1, 'Étape démarrée') RETURNING id`,
      [deploymentId],
    );
    const id = res.rows[0]!.id;
    await expectAuditViolation(
      `UPDATE deployment_logs SET message = 'effacé' WHERE id = $1`,
      [id],
    );
  });

  // ─── deployment_state_transitions ────────────────────────────────────────────

  test('deployment_state_transitions — UPDATE rejeté (INV-04)', async () => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO deployment_state_transitions (deployment_id, from_state, to_state)
       VALUES ($1, 'pending', 'running') RETURNING id`,
      [deploymentId],
    );
    const id = res.rows[0]!.id;
    await expectAuditViolation(
      `UPDATE deployment_state_transitions SET to_state = 'success' WHERE id = $1`,
      [id],
    );
  });

  // ─── deployment_snapshots ────────────────────────────────────────────────────

  test('deployment_snapshots — UPDATE rejeté (INV-04, ADR-0004)', async () => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO deployment_snapshots (deployment_id, commit_sha)
       VALUES ($1, 'abc1234') RETURNING id`,
      [deploymentId],
    );
    const id = res.rows[0]!.id;
    await expectAuditViolation(
      `UPDATE deployment_snapshots SET commit_sha = 'tampered' WHERE id = $1`,
      [id],
    );
  });

  // ─── payment_transactions ────────────────────────────────────────────────────

  test('payment_transactions — UPDATE rejeté (INV-04)', async () => {
    await expectAuditViolation(
      `UPDATE payment_transactions SET status = 'success' WHERE id = $1`,
      [transactionId],
    );
  });

  // ─── template_purchases ──────────────────────────────────────────────────────

  test('template_purchases — UPDATE rejeté (INV-04)', async () => {
    // template_purchases a RLS (org_id direct) : l'INSERT nécessite le contexte tenant.
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgId]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO template_purchases (org_id, template_id, transaction_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [orgId, templateId, transactionId],
    );
    await client.query('COMMIT');
    const id = res.rows[0]!.id;
    await expectAuditViolation(
      `UPDATE template_purchases SET org_id = gen_random_uuid() WHERE id = $1`,
      [id],
    );
  });
});
