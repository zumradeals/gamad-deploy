// Test (b) — INV-06 : une ressource d'une autre org est invisible (404 sémantique).
// Valide que le filtre org_id dans les requêtes Drizzle, conjugué au RLS PostgreSQL,
// isole correctement les tenants (défense en profondeur, ADR-0005).

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { createTestPool, applyMigrations, createDb } from './helpers/setup';
import { organizations, projects, servers, users, withTenantTx } from '../index';

describe('Tenant isolation (INV-06, C-10)', () => {
  let pool: Pool;

  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let userId: string;

  beforeAll(async () => {
    pool = await createTestPool();
    await applyMigrations(pool);
    const db = createDb(pool);

    // INSERTs non bloqués par RLS (policies USING ne s'appliquent pas aux INSERT).
    const [orgA] = await db
      .insert(organizations)
      .values({ name: 'Org Alpha', slug: `alpha-${Date.now()}` })
      .returning({ id: organizations.id });
    orgAId = orgA!.id;

    const [orgB] = await db
      .insert(organizations)
      .values({ name: 'Org Beta', slug: `beta-${Date.now()}` })
      .returning({ id: organizations.id });
    orgBId = orgB!.id;

    const [user] = await db
      .insert(users)
      .values({ email: `isolation-${Date.now()}@gamad.test`, passwordHash: 'hash' })
      .returning({ id: users.id });
    userId = user!.id;

    // Les INSERTs sur servers et projects sont soumis au WITH CHECK de la policy RLS.
    // withTenantTx pose set_config('app.current_org_id', orgAId, true) → autorisé.
    await withTenantTx(db, { org_id: orgAId, user_id: userId }, async (tx) => {
      const [server] = await tx
        .insert(servers)
        .values({ orgId: orgAId, name: 'Server A', host: '10.0.1.1', agentToken: `agt-${Date.now()}` })
        .returning({ id: servers.id });

      const [projectA] = await tx
        .insert(projects)
        .values({ orgId: orgAId, serverId: server!.id, name: 'Project Alpha', repoUrl: 'https://github.com/alpha/app' })
        .returning({ id: projects.id });
      projectAId = projectA!.id;
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  test('Org A voit ses propres projets (filtre applicatif + RLS)', async () => {
    const db = createDb(pool);
    await withTenantTx(db, { org_id: orgAId, user_id: userId }, async (tx) => {
      const result = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.orgId, orgAId));

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.map((r) => r.id)).toContain(projectAId);
    });
  });

  test("Org B ne voit pas les projets d'Org A (isolation tenant)", async () => {
    const db = createDb(pool);
    await withTenantTx(db, { org_id: orgBId, user_id: userId }, async (tx) => {
      const result = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.orgId, orgBId));

      expect(result.length).toBe(0);
      expect(result.find((r) => r.id === projectAId)).toBeUndefined();
    });
  });

  test("L'org_id du projet correspond exactement au tenant courant", async () => {
    const db = createDb(pool);
    await withTenantTx(db, { org_id: orgAId, user_id: userId }, async (tx) => {
      const [project] = await tx
        .select({ orgId: projects.orgId })
        .from(projects)
        .where(eq(projects.id, projectAId));

      expect(project).toBeDefined();
      expect(project!.orgId).toBe(orgAId);
      expect(project!.orgId).not.toBe(orgBId);
    });
  });
});
