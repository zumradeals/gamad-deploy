// AdminTemplatesController — gestion des templates marketplace (Phase 2, superadmin).
// Permet de changer le statut d'un template (draft → valid → certified).

import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { templates, templatePurchases, organizationMembers, users } from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';

interface ChangeStatusBody {
  status: 'draft' | 'valid' | 'certified';
}

@Controller('admin/templates')
@UseGuards(AdminGuard)
export class AdminTemplatesController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/templates — tous les templates (tous statuts).
   */
  @Get()
  async listTemplates() {
    const rows = await this.db
      .select({
        id: templates.id,
        name: templates.name,
        slug: templates.slug,
        marketplaceLevel: templates.marketplaceLevel,
        ownerOrgId: templates.ownerOrgId,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .orderBy(templates.createdAt);

    const data = await Promise.all(
      rows.map(async (t) => {
        // Trouver l'email du propriétaire (owner) de l'org auteure
        let authorEmail: string | null = null;
        if (t.ownerOrgId) {
          const [ownerRow] = await this.db
            .select({ email: users.email })
            .from(organizationMembers)
            .innerJoin(users, eq(organizationMembers.userId, users.id))
            .where(eq(organizationMembers.orgId, t.ownerOrgId))
            .orderBy(organizationMembers.createdAt)
            .limit(1);
          authorEmail = ownerRow?.email ?? null;
        }

        const [usageRow] = await this.db
          .select({ nb: count() })
          .from(templatePurchases)
          .where(eq(templatePurchases.templateId, t.id));

        return {
          id: t.id,
          name: t.name,
          level: t.marketplaceLevel,
          authorEmail,
          usageCount: Number(usageRow?.nb ?? 0),
          createdAt: t.createdAt,
        };
      }),
    );

    return { data };
  }

  /**
   * PATCH /admin/templates/:id/status — changer le statut marketplace.
   */
  @Patch(':id/status')
  async changeTemplateStatus(
    @Param('id') id: string,
    @Body() body: ChangeStatusBody,
  ) {
    const validStatuses = ['draft', 'valid', 'certified'] as const;
    if (!validStatuses.includes(body.status as (typeof validStatuses)[number])) {
      throw new BadRequestException('Statut invalide. Valeurs acceptées : draft, valid, certified.');
    }

    const [template] = await this.db
      .select({ id: templates.id, marketplaceLevel: templates.marketplaceLevel })
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);

    if (!template) {
      throw new NotFoundException('Template introuvable.');
    }

    await this.db
      .update(templates)
      .set({ marketplaceLevel: body.status, updatedAt: new Date() })
      .where(eq(templates.id, id));

    return {
      templateId: id,
      previousLevel: template.marketplaceLevel,
      newLevel: body.status,
    };
  }
}
