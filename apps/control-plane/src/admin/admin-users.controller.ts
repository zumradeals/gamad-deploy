// AdminUsersController — gestion des utilisateurs (Phase 2, superadmin).
// Routes cross-tenant : pas de withTenantTx, lectures directes (INV-06).
// Impersonation : JWT signé 1h avec claim impersonated_by pour audit.

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, ilike, or, count, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import jwt from 'jsonwebtoken';
import {
  users,
  organizations,
  organizationMembers,
  userRoles,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';
import type { TenantRequest } from '../persistence/tenant-middleware';

interface ChangeRoleBody {
  role: 'superadmin' | 'support' | 'user';
}

interface SuspendBody {
  suspend: boolean;
}

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/users — liste paginée avec search sur email/fullName.
   */
  @Get()
  async listUsers(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '20', 10) || 20));
    const offset = (page - 1) * limit;

    // Filtre ILIKE sur email et full_name
    const whereClause = search && search.trim().length > 0
      ? or(
          ilike(users.email, `%${search.trim()}%`),
          ilike(sql`COALESCE(${users.fullName}, '')`, `%${search.trim()}%`),
        )
      : undefined;

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(users)
      .where(whereClause);

    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        suspendedAt: users.suspendedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(users.createdAt)
      .limit(limit)
      .offset(offset);

    // Pour chaque utilisateur : platform_role + compter les orgs membres
    const data = await Promise.all(
      rows.map(async (u) => {
        const [roleRow] = await this.db
          .select({ role: userRoles.role })
          .from(userRoles)
          .where(eq(userRoles.userId, u.id))
          .limit(1);

        const [orgsCountRow] = await this.db
          .select({ nb: count() })
          .from(organizationMembers)
          .where(eq(organizationMembers.userId, u.id));

        return {
          id: u.id,
          email: u.email,
          fullName: u.fullName ?? null,
          platformRole: roleRow?.role ?? null,
          suspendedAt: u.suspendedAt ?? null,
          createdAt: u.createdAt,
          orgsCount: Number(orgsCountRow?.nb ?? 0),
        };
      }),
    );

    return {
      data,
      total: Number(totalRow?.total ?? 0),
      page,
      limit,
    };
  }

  /**
   * GET /admin/users/:id — détail complet : infos + orgs membres + platform_role.
   */
  @Get(':id')
  async getUserDetail(@Param('id') id: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        suspendedAt: users.suspendedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const [roleRow] = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, id))
      .limit(1);

    const orgMemberships = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        orgRole: organizationMembers.orgRole,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.orgId, organizations.id))
      .where(eq(organizationMembers.userId, id));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName ?? null,
      platformRole: roleRow?.role ?? null,
      suspendedAt: user.suspendedAt ?? null,
      createdAt: user.createdAt,
      orgs: orgMemberships.map((m) => ({
        id: m.id,
        name: m.name,
        orgRole: m.orgRole,
      })),
    };
  }

  /**
   * PATCH /admin/users/:id/role — changer platform_role.
   * Upsert : supprime l'ancien rôle et insère le nouveau (table user_roles).
   */
  @Patch(':id/role')
  async changeUserRole(
    @Param('id') id: string,
    @Body() body: ChangeRoleBody,
  ) {
    const validRoles = ['superadmin', 'support', 'user'] as const;
    if (!validRoles.includes(body.role as (typeof validRoles)[number])) {
      throw new BadRequestException('Rôle invalide. Valeurs acceptées : superadmin, support, user.');
    }

    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // Supprimer tout rôle existant puis insérer le nouveau
    await this.db.delete(userRoles).where(eq(userRoles.userId, id));
    await this.db.insert(userRoles).values({ userId: id, role: body.role });

    return { userId: id, role: body.role };
  }

  /**
   * PATCH /admin/users/:id/suspend — suspendre (suspend=true) ou réactiver (suspend=false).
   */
  @Patch(':id/suspend')
  async suspendUser(
    @Param('id') id: string,
    @Body() body: SuspendBody,
  ) {
    if (typeof body.suspend !== 'boolean') {
      throw new BadRequestException('Le champ "suspend" doit être un booléen.');
    }

    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const suspendedAt = body.suspend ? new Date() : null;
    await this.db
      .update(users)
      .set({ suspendedAt, updatedAt: new Date() })
      .where(eq(users.id, id));

    return { userId: id, suspended: body.suspend, suspendedAt };
  }

  /**
   * POST /admin/users/:id/impersonate — retourne un JWT valide 1h.
   * Claims : { org_id, user_id, impersonated_by: adminId }.
   * L'admin doit appartenir à au moins une org pour que le JWT soit valide.
   */
  @Post(':id/impersonate')
  async impersonateUser(
    @Param('id') id: string,
    @Req() req: TenantRequest,
  ) {
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET non configuré.');
    }

    const [user] = await this.db
      .select({ id: users.id, email: users.email, suspendedAt: users.suspendedAt })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    if (user.suspendedAt !== null) {
      throw new BadRequestException('Impossible d\'impersonner un compte suspendu.');
    }

    // Trouver l'org principale de l'utilisateur (première org membre)
    const [membership] = await this.db
      .select({ orgId: organizationMembers.orgId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, id))
      .orderBy(organizationMembers.createdAt)
      .limit(1);

    if (!membership) {
      throw new BadRequestException('L\'utilisateur n\'appartient à aucune organisation.');
    }

    const adminUserId = req.tenant.user_id;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1h

    const token = jwt.sign(
      {
        user_id: id,
        org_id: membership.orgId,
        impersonated_by: adminUserId,
      },
      secret,
      { expiresIn: '1h' },
    );

    return { token, expiresAt };
  }
}
