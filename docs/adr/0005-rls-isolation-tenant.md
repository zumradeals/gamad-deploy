# ADR-0005 — Isolation tenant garantie par RLS PostgreSQL

**Date** : 2026-05-23
**Statut** : Accepté
**Contexte** : P-01.5 — complément à P-01 avant merge de PR #2

---

## Contexte

À l'issue de P-01, l'isolation tenant reposait exclusivement sur la discipline
applicative : chaque repository devait ajouter `.where(eq(table.orgId, ctx.org_id))`
à ses requêtes Drizzle. Le `TenantMiddleware` injectait correctement le `TenantContext`
(INV-06), mais aucun mécanisme central n'empêchait un repository qui omettrait le
filtre d'exposer les données d'un autre tenant.

Diagnostic énoncé avant code : "un futur repository en P-05 qui OUBLIERAIT de filtrer
org_id ne serait pas rattrapé automatiquement". Cette fragilité est inacceptable pour
un système multi-tenant souverain — surtout au moment où la couche persistence est
encore vierge.

---

## Décision

Activation du **Row-Level Security (RLS) PostgreSQL** sur toutes les tables métier
portant `org_id`, avant toute implémentation de repository (P-02+).

### Mécanisme : `set_config` LOCAL + `withTenantTx`

```sql
-- Dans chaque transaction applicative :
SELECT set_config('app.current_org_id', '<uuid>', true);
-- is_local = true → valeur locale à la transaction courante
-- Au COMMIT/ROLLBACK : reset automatique → aucune fuite entre connexions poolées

-- Policy sur chaque table tenant :
CREATE POLICY tenant_isolation ON <table>
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
```

Le `NULLIF(..., '')` protège contre un setting vide qui ferait échouer le cast
`::uuid`. Si `app.current_org_id` n'est pas configuré, la policy retourne `NULL`
(not true) → toutes les lignes sont invisibles → **deny-by-default**.

`FORCE ROW LEVEL SECURITY` est ajouté sur chaque table car le rôle `gamad` est
propriétaire des tables et contourne RLS par défaut.

### Tables couvertes (migration 0002_rls.sql)

| Table | Policy |
|---|---|
| `organization_members` | `org_id = current_org_id()` |
| `servers` | `org_id = current_org_id()` |
| `projects` | `org_id = current_org_id()` |
| `deployments` | `project_id IN (SELECT id FROM projects WHERE org_id = current_org_id())` |
| `subscriptions` | `org_id = current_org_id()` |
| `payment_transactions` | `org_id = current_org_id()` |
| `template_purchases` | `org_id = current_org_id()` |
| `templates` | `owner_org_id IS NULL OR owner_org_id = current_org_id()` |

Tables sans `org_id` direct (`deployment_plans`, `deployment_logs`,
`deployment_state_transitions`, `deployment_snapshots`, `repo_contracts`) ne
reçoivent pas de policy directe en P-01.5. Elles sont protégées indirectement par :
la policy sur `deployments`/`projects` (accès parent bloqué), le trigger INV-04
(audit tables), et le filtre applicatif obligatoire via `withTenantTx`.

### `withTenantTx` — règle permanente de la couche persistence

```typescript
// packages/schema/src/tenant-tx.ts
export async function withTenantTx<T>(
  db: AnyPgDb,
  ctx: TenantContext,
  fn: (tx: AnyPgDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${ctx.org_id}, true)`,
    );
    return fn(tx);
  });
}
```

**RÈGLE PERMANENTE** : toute requête sur une table portant `org_id` s'exécute
obligatoirement dans une transaction ouverte par `withTenantTx`. Cette règle
s'applique à tous les prompts P-02 et suivants. Une requête directe sur une table
tenant hors de `withTenantTx` est une violation de INV-06, à refuser en revue.

---

## Piège évité : `SET` de session avec un pool

`SET app.current_org_id = '<uuid>'` (sans LOCAL) est un **setting de session** :
il survit au COMMIT/ROLLBACK et reste attaché à la connexion physique. Avec un pool,
la connexion suivante héritera de l'ancien `org_id` — fuite garantie entre tenants.

Les deux fausses solutions écartées :
- **Reset manuel avant release** : fragile si la requête crashe avant le reset.
- **`pool.on('connect')`** : ne se déclenche qu'à la création d'une connexion physique,
  pas à chaque checkout depuis le pool.

`set_config(..., true)` (is_local) est la seule solution correcte : reset automatique
au COMMIT/ROLLBACK, sans nettoyage manuel, sans risque de fuite.

---

## Alternatives écartées

### Base class `TenantRepository<T>`
Oblige à passer par la classe, visible à la revue, mais n'est pas une garantie
compile-time. Un repository qui hérite d'une autre classe, ou utilise Drizzle
directement, contourne silencieusement. Insuffisant seul.

### ESLint custom rule
Flagge `.from(tenantTable)` sans `.where()` contenant `orgId`. Prévention statique,
mais seulement pour les motifs reconnus par la règle. N'attrape pas les requêtes
dynamiques, les raw SQL, ou les requêtes construites via des helpers intermédiaires.
Insuffisant seul.

### RLS uniquement, sans filtre applicatif
Serait suffisant techniquement, mais perd la défense en profondeur. Une erreur de
migration RLS ou un bug de `set_config` n'aurait aucun filet. Les deux couches
(RLS + filtre applicatif) sont maintenues simultanément — la suppression de l'une
ou l'autre est une violation de ce ADR.

---

## Conséquences

- **Positive** : toute requête SELECT/UPDATE/DELETE sur une table tenant sans
  `set_config` préalable retourne 0 lignes (pas d'erreur, pas de fuite). C'est le
  comportement fail-safe voulu.
- **Positive** : les tests de garantie (`rls-guarantee.test.ts`) prouvent cette
  propriété structurellement sur au moins deux tables.
- **Contrainte** : toute connexion applicative qui lit des tables tenant doit passer
  par `withTenantTx`. Les migrations (exécutées sans context tenant) ne sont pas
  affectées : les policies `USING` ne bloquent pas les INSERT, et Drizzle migrator
  utilise le rôle propriétaire qui, même avec `FORCE RLS`, reçoit des policies sur
  les SELECT/UPDATE/DELETE mais les migrations n'en font pas sur des tables non encore
  peuplées avec données croisées.
- **Contrainte** : les requêtes d'administration (superadmin listant toutes les orgs)
  devront utiliser un rôle avec `BYPASSRLS` ou poser explicitement un contexte étendu.
  Ce cas est hors scope de P-01.5 et sera traité en P-08+ (backoffice).
