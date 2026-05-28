// AdminPlansController — gestion des plans tarifaires (Phase 2, superadmin).
// DELETE réel interdit (INV-04 esprit) — désactivation via is_active = false.

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { plans } from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';

interface PlanBody {
  name: string;
  slug?: string;
  priceAmount: number;
  currency?: string;
  isActive?: boolean;
  limits: {
    max_projects?: number;
    max_servers?: number;
    max_deployments_month?: number;
    [key: string]: unknown;
  };
}

@Controller('admin/plans')
@UseGuards(AdminGuard)
export class AdminPlansController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/plans — tous les plans (actifs et inactifs).
   */
  @Get()
  async listPlans() {
    const rows = await this.db
      .select()
      .from(plans)
      .orderBy(plans.createdAt);

    return rows;
  }

  /**
   * POST /admin/plans — créer un nouveau plan.
   */
  @Post()
  async createPlan(@Body() body: PlanBody) {
    this.validatePlanBody(body);

    const slug = body.slug ?? this.generateSlug(body.name);

    const [existing] = await this.db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.slug, slug))
      .limit(1);

    if (existing) {
      throw new BadRequestException(`Un plan avec le slug "${slug}" existe déjà.`);
    }

    const [created] = await this.db
      .insert(plans)
      .values({
        name: body.name,
        slug,
        priceAmount: body.priceAmount,
        currency: body.currency ?? 'XOF',
        isActive: body.isActive ?? true,
        limits: body.limits,
      })
      .returning();

    return created;
  }

  /**
   * PATCH /admin/plans/:id — modifier un plan existant.
   */
  @Patch(':id')
  async updatePlan(
    @Param('id') id: string,
    @Body() body: Partial<PlanBody>,
  ) {
    const [plan] = await this.db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);

    if (!plan) {
      throw new NotFoundException('Plan introuvable.');
    }

    const updateData: Partial<{
      name: string;
      slug: string;
      priceAmount: number;
      currency: string;
      isActive: boolean;
      limits: Record<string, unknown>;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.priceAmount !== undefined) {
      if (typeof body.priceAmount !== 'number' || body.priceAmount < 0) {
        throw new BadRequestException('priceAmount doit être un entier positif ou nul.');
      }
      updateData.priceAmount = body.priceAmount;
    }
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.limits !== undefined) updateData.limits = body.limits;

    const [updated] = await this.db
      .update(plans)
      .set(updateData)
      .where(eq(plans.id, id))
      .returning();

    return updated;
  }

  /**
   * DELETE /admin/plans/:id — désactive le plan (is_active = false).
   * Aucun DELETE SQL réel (INV-04 esprit : les plans sont des faits permanents).
   */
  @Delete(':id')
  async deactivatePlan(@Param('id') id: string) {
    const [plan] = await this.db
      .select({ id: plans.id, isActive: plans.isActive })
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);

    if (!plan) {
      throw new NotFoundException('Plan introuvable.');
    }

    await this.db
      .update(plans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(plans.id, id));

    return { planId: id, isActive: false };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private validatePlanBody(body: PlanBody): void {
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new BadRequestException('Le champ "name" est requis.');
    }
    if (typeof body.priceAmount !== 'number' || body.priceAmount < 0) {
      throw new BadRequestException('priceAmount doit être un entier positif ou nul.');
    }
    if (!body.limits || typeof body.limits !== 'object') {
      throw new BadRequestException('Le champ "limits" est requis (objet).');
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
