// AdminOrgsController — gestion des organisations (Phase 2, superadmin).
// Routes cross-tenant : pas de withTenantTx, lectures directes (INV-06).

import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, ilike, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  organizations,
  organizationMembers,
  users,
  plans,
  servers,
  projects,
  deployments,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';

interface ChangePlanBody {
  planId: string;
}

@Controller('admin/orgs')
@UseGuards(AdminGuard)
export class AdminOrgsController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/orgs — liste paginée avec search sur name/slug.
   */
  @Get()
  async listOrgs(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '20', 10) || 20));
    const offset = (page - 1) * limit;

    const whereClause = search && search.trim().length > 0
      ? ilike(organizations.name, `%${search.trim()}%`)
      : undefined;

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(organizations)
      .where(whereClause);

    const rows = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        planId: organizations.planId,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(whereClause)
      .orderBy(organizations.createdAt)
      .limit(limit)
      .offset(offset);

    const data = await Promise.all(
      rows.map(async (org) => {
        const [planRow] = org.planId
          ? await this.db
              .select({ name: plans.name })
              .from(plans)
              .where(eq(plans.id, org.planId))
              .limit(1)
          : [];

        const [membersCountRow] = await this.db
          .select({ nb: count() })
          .from(organizationMembers)
          .where(eq(organizationMembers.orgId, org.id));

        const [projectsCountRow] = await this.db
          .select({ nb: count() })
          .from(projects)
          .where(eq(projects.orgId, org.id));

        const [serversCountRow] = await this.db
          .select({ nb: count() })
          .from(servers)
          .where(eq(servers.orgId, org.id));

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          planName: planRow?.name ?? null,
          membersCount: Number(membersCountRow?.nb ?? 0),
          projectsCount: Number(projectsCountRow?.nb ?? 0),
          serversCount: Number(serversCountRow?.nb ?? 0),
          createdAt: org.createdAt,
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
   * GET /admin/orgs/:id — détail org : membres, projets count, serveurs, plan.
   */
  @Get(':id')
  async getOrgDetail(@Param('id') id: string) {
    const [org] = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        planId: organizations.planId,
      })
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) {
      throw new NotFoundException('Organisation introuvable.');
    }

    const planRow = org.planId
      ? await this.db
          .select({ id: plans.id, name: plans.name })
          .from(plans)
          .where(eq(plans.id, org.planId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : null;

    const members = await this.db
      .select({
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
        orgRole: organizationMembers.orgRole,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.orgId, id));

    const [projectsCountRow] = await this.db
      .select({ nb: count() })
      .from(projects)
      .where(eq(projects.orgId, id));

    const [serversCountRow] = await this.db
      .select({ nb: count() })
      .from(servers)
      .where(eq(servers.orgId, id));

    // Compter les déploiements via les projets de l'org
    const orgProjects = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, id));

    let deploymentsCount = 0;
    if (orgProjects.length > 0) {
      const projectIds = orgProjects.map((p) => p.id);
      // Somme des déploiements pour chaque projet
      for (const projectId of projectIds) {
        const [depRow] = await this.db
          .select({ nb: count() })
          .from(deployments)
          .where(eq(deployments.projectId, projectId));
        deploymentsCount += Number(depRow?.nb ?? 0);
      }
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: planRow ? { id: planRow.id, name: planRow.name } : null,
      members: members.map((m) => ({
        userId: m.userId,
        email: m.email,
        fullName: m.fullName ?? null,
        orgRole: m.orgRole,
      })),
      stats: {
        projectsCount: Number(projectsCountRow?.nb ?? 0),
        serversCount: Number(serversCountRow?.nb ?? 0),
        deploymentsCount,
      },
    };
  }

  /**
   * PATCH /admin/orgs/:id/plan — changer le plan d'une organisation.
   */
  @Patch(':id/plan')
  async changeOrgPlan(
    @Param('id') id: string,
    @Body() body: ChangePlanBody,
  ) {
    if (!body.planId || typeof body.planId !== 'string') {
      throw new BadRequestException('Le champ "planId" est requis.');
    }

    const [org] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) {
      throw new NotFoundException('Organisation introuvable.');
    }

    const [plan] = await this.db
      .select({ id: plans.id, name: plans.name, isActive: plans.isActive })
      .from(plans)
      .where(eq(plans.id, body.planId))
      .limit(1);

    if (!plan) {
      throw new NotFoundException('Plan introuvable.');
    }

    if (!plan.isActive) {
      throw new BadRequestException('Impossible d\'assigner un plan désactivé.');
    }

    await this.db
      .update(organizations)
      .set({ planId: body.planId, updatedAt: new Date() })
      .where(eq(organizations.id, id));

    return { orgId: id, planId: body.planId, planName: plan.name };
  }
}
