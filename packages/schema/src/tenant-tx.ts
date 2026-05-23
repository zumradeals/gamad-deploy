// RÈGLE PERMANENTE (ADR-0005, INV-06) : toute requête sur une table portant org_id
// s'exécute OBLIGATOIREMENT dans une transaction ouverte par withTenantTx.
// Jamais de requête directe sur une table tenant hors de ce wrapper.
//
// Mécanisme : set_config('app.current_org_id', orgId, true) est is_local = true,
// ce qui scoping la valeur à la transaction courante. Au COMMIT/ROLLBACK, le setting
// est automatiquement remis à sa valeur précédente → aucune fuite entre connexions poolées.

import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TenantContext } from '@gamad/contracts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPgDb = NodePgDatabase<any>;

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
