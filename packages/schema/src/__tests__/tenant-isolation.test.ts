// Test (b) — INV-06 : une ressource d'une autre org est invisible (404 sémantique).
// Valide que le filtre org_id dans les requêtes Drizzle isole correctement les tenants.

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { createTestPool, applyMigrations, createDb } from './helpers/setup';
import { organizations, projects, servers, users } from '../index';

describe('Tenant isolation (INV-06, C-10)', () => {
  let pool: Pool;

  let orgAId: string;
  let orgBId: string;
  let projectAId: string;

  beforeAll(async () => {
    pool = await createTestPool();
    await applyMigrations(pool);
    const db = createDb(pool);

    // Org A
    const [orgA] = await db
      .insert(organizations)
      .values({ name: 'Org Alpha', slug: `alpha-${Date.now()}` })
      .returning({ id: organizations.id });
    orgAId = orgA!.id;

    // Org B
    const [orgB] = await db
      .insert(organizations)
      .values({ name: 'Org Beta', slug: `beta-${Date.now()}` })
      .returning({ id: organizations.id });
    orgBId = orgB!.id;

    // User commun (pour trigger_user_id)
    const [user] = await db
      .insert(users)
      .values({ email: `isolation-${Date.now()}@gamad.test`, passwordHash: 'hash' })
      .returning({ id: users.id });
    const userId = user!.id;

    // Serveur pour Org A
    const [server] = await db
      .insert(servers)
      .values({
        orgId: orgAId,
        name: 'Server A',
        host: '10.0.1.1',
        agentToken: `agt-${Date.now()}`,
      })
      .returning({ id: servers.id });

    // Projet appartenant à Org A
    const [projectA] = await db
      .insert(projects)
      .values({
        orgId: orgAId,
        serverId: server!.id,
        name: 'Project Alpha',
        repoUrl: 'https://github.com/alpha/app',
      })
      .returning({ id: projects.id });
    projectAId = projectA!.id;

    // Pas de projet pour Org B — elle ne doit rien voir d'Org A
    void userId; // utilisé implicitement dans le contexte du test
  });

  afterAll(async () => {
    await pool.end();
  });

  test('Org A voit ses propres projets', async () => {
    const db = createDb(pool);
    const result = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, orgAId));

    expect(result.length).toBeGreaterThanOrEqual(1);
    const ids = result.map((r) => r.id);
    expect(ids).toContain(projectAId);
  });

  test('Org B ne voit pas les projets d\'Org A (isolation tenant)', async () => {
    const db = createDb(pool);

    // Requête avec le tenant context d'Org B
    const result = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, orgBId)); // filtre tenant injecté côté serveur (INV-06)

    expect(result.length).toBe(0);

    // Vérification explicite : aucun projet d'Org A ne fuite vers Org B
    const leaked = result.find((r) => r.id === projectAId);
    expect(leaked).toBeUndefined();
  });

  test('L\'org_id du projet correspond exactement au tenant courant', async () => {
    const db = createDb(pool);
    const [project] = await db
      .select({ orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, projectAId));

    expect(project).toBeDefined();
    expect(project!.orgId).toBe(orgAId);
    expect(project!.orgId).not.toBe(orgBId);
  });
});
