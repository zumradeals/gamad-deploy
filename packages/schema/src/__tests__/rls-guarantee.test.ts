// Test de garantie RLS (ADR-0005, INV-06) — preuve structurelle.
//
// Ce test distingue "ça marche si on filtre" (tenant-isolation.test.ts)
// de "c'est IMPOSSIBLE de fuiter même sans filtre applicatif".
//
// Phase 1 : avec filtre WHERE org_id = ? (discipline applicative).
// Phase 2 : SANS aucun filtre WHERE, dans un contexte tenant org-B —
//   le RLS seul bloque l'accès aux données d'org-A.
//   Si ce test passe, un développeur qui oublie le WHERE ne peut pas fuiter.
//
// Couvre au moins 2 tables tenant directes (projects + servers) pour prouver
// que les policies RLS sont posées sur TOUTES les tables métier, pas une seule.

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { createTestPool, applyMigrations, createDb } from './helpers/setup';
import { organizations, projects, servers, users, withTenantTx } from '../index';

describe('RLS guarantee — isolation structurelle (INV-06, ADR-0005)', () => {
  let pool: Pool;

  let orgAId: string;
  let orgBId: string;
  let userId: string;
  let projectAId: string;
  let serverAId: string;

  beforeAll(async () => {
    pool = await createTestPool();
    await applyMigrations(pool);
    const db = createDb(pool);

    const ts = Date.now();

    const [orgA] = await db
      .insert(organizations)
      .values({ name: 'RLS Org A', slug: `rls-a-${ts}` })
      .returning({ id: organizations.id });
    orgAId = orgA!.id;

    const [orgB] = await db
      .insert(organizations)
      .values({ name: 'RLS Org B', slug: `rls-b-${ts}` })
      .returning({ id: organizations.id });
    orgBId = orgB!.id;

    const [user] = await db
      .insert(users)
      .values({ email: `rls-${ts}@gamad.test`, passwordHash: 'hash' })
      .returning({ id: users.id });
    userId = user!.id;

    // INSERTs tenant via withTenantTx : WITH CHECK de la policy USING autorise
    // uniquement les rows dont org_id = current_org_id() (= orgAId ici).
    await withTenantTx(db, { org_id: orgAId, user_id: userId }, async (tx) => {
      const [server] = await tx
        .insert(servers)
        .values({ orgId: orgAId, name: 'RLS Server A', host: '10.1.0.1', agentToken: `rls-agt-${ts}` })
        .returning({ id: servers.id });
      serverAId = server!.id;

      const [project] = await tx
        .insert(projects)
        .values({ orgId: orgAId, serverId: serverAId, name: 'RLS Project A', repoUrl: 'https://github.com/rls/a' })
        .returning({ id: projects.id });
      projectAId = project!.id;
    });

    // Org-B n'a aucune ressource — elle ne doit jamais voir celles d'org-A.
  });

  afterAll(async () => {
    await pool.end();
  });

  // ── Phase 1 : filtre applicatif (défense en profondeur) ──────────────────

  test('Phase 1 — projects : filtre applicatif + RLS (org-A voit ses données)', async () => {
    const db = createDb(pool);
    await withTenantTx(db, { org_id: orgAId, user_id: userId }, async (tx) => {
      const result = await tx.select({ id: projects.id }).from(projects)
        .where(eq(projects.orgId, orgAId));
      expect(result.map((r) => r.id)).toContain(projectAId);
    });
  });

  test('Phase 1 — servers : filtre applicatif + RLS (org-A voit ses données)', async () => {
    const db = createDb(pool);
    await withTenantTx(db, { org_id: orgAId, user_id: userId }, async (tx) => {
      const result = await tx.select({ id: servers.id }).from(servers)
        .where(eq(servers.orgId, orgAId));
      expect(result.map((r) => r.id)).toContain(serverAId);
    });
  });

  // ── Phase 2 : SANS filtre applicatif — RLS seul (preuve structurelle) ────

  test('Phase 2 — projects : requête sans WHERE dans contexte org-B → 0 ligne (RLS seul)', async () => {
    const db = createDb(pool);
    await withTenantTx(db, { org_id: orgBId, user_id: userId }, async (tx) => {
      // Pas de .where() — requête naïve qui fuite dans un système sans RLS.
      const leaked = await tx.select({ id: projects.id }).from(projects);
      expect(leaked).toHaveLength(0);
      expect(leaked.find((r) => r.id === projectAId)).toBeUndefined();
    });
  });

  test('Phase 2 — servers : requête sans WHERE dans contexte org-B → 0 ligne (RLS seul)', async () => {
    const db = createDb(pool);
    await withTenantTx(db, { org_id: orgBId, user_id: userId }, async (tx) => {
      const leaked = await tx.select({ id: servers.id }).from(servers);
      expect(leaked).toHaveLength(0);
      expect(leaked.find((r) => r.id === serverAId)).toBeUndefined();
    });
  });
});
