// AuthorizationHelper — lecture des rôles EN BASE, jamais depuis le JWT (INV-06)
// org_role  → table organization_members (pouvoir dans une org)
// platform_role → table user_roles (pouvoir sur la plateforme)
// Séparation org_role / platform_role : conforme à C-10 et docs/03 §3.2.

import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TenantContext, OrgRole, PlatformRole } from '@gamad/contracts';
import { organizationMembers, userRoles } from '@gamad/schema';

@Injectable()
export class AuthorizationHelper {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Retourne le rôle de l'utilisateur dans l'organisation courante.
   * Lu en base à chaque appel — jamais mis en cache depuis le JWT (INV-06).
   * Retourne null si l'utilisateur n'est pas membre de l'organisation.
   */
  async getOrgRole(ctx: TenantContext): Promise<OrgRole | null> {
    const [row] = await this.db
      .select({ orgRole: organizationMembers.orgRole })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.orgId, ctx.org_id),
          eq(organizationMembers.userId, ctx.user_id),
        ),
      );
    return row?.orgRole ?? null;
  }

  /**
   * Retourne le rôle plateforme de l'utilisateur (superadmin, support, user).
   * Lu en base à chaque appel — jamais mis en cache depuis le JWT (INV-06).
   */
  async getPlatformRole(ctx: TenantContext): Promise<PlatformRole | null> {
    const [row] = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, ctx.user_id));
    return row?.role ?? null;
  }

  /**
   * Vérifie qu'une ressource appartient bien au tenant courant.
   * Une ressource d'une autre org est invisible (404, pas 403 — C-12, C-10).
   */
  async assertOrgOwnership(ctx: TenantContext, resourceOrgId: string): Promise<void> {
    if (resourceOrgId !== ctx.org_id) {
      // 404 intentionnel : ne pas révéler l'existence de la ressource (INV-06)
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException();
    }
  }
}
