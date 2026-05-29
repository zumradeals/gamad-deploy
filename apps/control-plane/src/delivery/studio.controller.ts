// StudioController — Couche Delivery (C-12).
// Espace de création de templates pour les membres d'une org.
// INV-06 : orgId injecté via JWT côté serveur.
// INV-04 : template_revisions et template_certifications INSERT-only.
// INV-05 : UUID v4 partout, jamais de clés séquentielles exposées.

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  templateBlueprints,
  templateRevisions,
  templateComponents,
  templates,
  aiGenerationLogs,
  subscriptions,
  withTenantTx,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import type { AIGeneratorPort } from '../domain/ai-generator/ai-generator.port';
import type { TenantRequest } from '../persistence/tenant-middleware';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class CreateBlueprintDto {
  name!: string;
  description?: string;
  tags?: string[];
  category!: 'web_app' | 'cms' | 'ecommerce' | 'stack' | 'data_tools' | 'devops';
  isComposed?: boolean;
  contractContent?: string;
}

class UpdateBlueprintDto {
  name?: string;
  description?: string;
  tags?: string[];
  contractContent?: string;
}

class AddComponentDto {
  componentTemplateId!: string;
  order?: number;
  configOverrides?: Record<string, unknown>;
}

class GenerateTemplateDto {
  description!: string;
  category!: 'web_app' | 'cms' | 'ecommerce' | 'stack' | 'data_tools' | 'devops';
  blueprintId?: string;
  referenceTemplates?: string[];
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('studio')
export class StudioController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: NodePgDatabase,
    private readonly aiGenerator: AIGeneratorPort,
  ) {}

  /** GET /studio/reference — templates GAMAD Officiel utilisables comme composants */
  @Get('reference')
  async listReference() {
    const rows = await this.db
      .select({
        id: templates.id,
        name: templates.name,
        slug: templates.slug,
        description: templates.description,
        tags: templates.tags,
        priceAmount: templates.priceAmount,
        contractContent: templates.contractContent,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(
        and(
          isNull(templates.ownerOrgId),
          eq(templates.marketplaceLevel, 'certified'),
          eq(templates.isPublished, true),
        ),
      );

    return rows.map((r) => ({
      ...r,
      tags: r.tags ?? [],
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** GET /studio/blueprints — liste des blueprints de l'org courante */
  @Get('blueprints')
  async list(@Req() req: TenantRequest) {
    const ctx = req.tenant;

    const rows = await this.db
      .select()
      .from(templateBlueprints)
      .where(eq(templateBlueprints.orgId, ctx.org_id))
      .orderBy(desc(templateBlueprints.updatedAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      tags: r.tags ?? [],
      category: r.category,
      isComposed: r.isComposed,
      status: r.status,
      latestRevisionId: r.latestRevisionId,
      certifiedTemplateId: r.certifiedTemplateId,
      repoUrl: r.repoUrl,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /** POST /studio/blueprints — créer un blueprint (+ première révision si contractContent fourni) */
  @Post('blueprints')
  async create(@Body() body: CreateBlueprintDto, @Req() req: TenantRequest) {
    const ctx = req.tenant;

    if (!body.name?.trim()) throw new BadRequestException('Le nom est requis.');
    if (!body.category) throw new BadRequestException('La catégorie est requise.');

    let blueprintId!: string;
    let firstRevisionId: string | null = null;

    await withTenantTx(this.db, ctx, async (tx) => {
      const [bp] = await tx
        .insert(templateBlueprints)
        .values({
          orgId: ctx.org_id,
          name: body.name.trim(),
          description: body.description?.trim() ?? '',
          tags: body.tags ?? [],
          category: body.category,
          isComposed: body.isComposed ?? false,
          createdBy: ctx.user_id,
        })
        .returning({ id: templateBlueprints.id });

      blueprintId = bp!.id;

      if (body.contractContent?.trim()) {
        const hash = createHash('sha256').update(body.contractContent).digest('hex');
        const [rev] = await tx
          .insert(templateRevisions)
          .values({
            blueprintId,
            version: 1,
            contractContent: body.contractContent,
            contentHash: hash,
            authorId: ctx.user_id,
          })
          .returning({ id: templateRevisions.id });

        firstRevisionId = rev!.id;

        await tx
          .update(templateBlueprints)
          .set({ latestRevisionId: firstRevisionId, updatedAt: new Date() })
          .where(eq(templateBlueprints.id, blueprintId));
      }
    });

    return { id: blueprintId, latestRevisionId: firstRevisionId };
  }

  /** GET /studio/blueprints/:id — détail + dernière révision + composants */
  @Get('blueprints/:id')
  async getOne(@Param('id') id: string, @Req() req: TenantRequest) {
    const ctx = req.tenant;

    const [bp] = await this.db
      .select()
      .from(templateBlueprints)
      .where(
        and(
          eq(templateBlueprints.id, id),
          eq(templateBlueprints.orgId, ctx.org_id),
        ),
      )
      .limit(1);

    if (!bp) throw new NotFoundException('Blueprint introuvable.');

    // Dernière révision
    const [latestRev] = bp.latestRevisionId
      ? await this.db
          .select()
          .from(templateRevisions)
          .where(eq(templateRevisions.id, bp.latestRevisionId))
          .limit(1)
      : [];

    // Historique des révisions
    const revisions = await this.db
      .select({
        id: templateRevisions.id,
        version: templateRevisions.version,
        contentHash: templateRevisions.contentHash,
        createdAt: templateRevisions.createdAt,
      })
      .from(templateRevisions)
      .where(eq(templateRevisions.blueprintId, id))
      .orderBy(desc(templateRevisions.version));

    // Composants (si template composé)
    const components = await this.db
      .select({
        id: templateComponents.id,
        componentTemplateId: templateComponents.componentTemplateId,
        order: templateComponents.order,
        configOverrides: templateComponents.configOverrides,
        name: templates.name,
        slug: templates.slug,
        priceAmount: templates.priceAmount,
      })
      .from(templateComponents)
      .innerJoin(templates, eq(templateComponents.componentTemplateId, templates.id))
      .where(eq(templateComponents.parentBlueprintId, id))
      .orderBy(templateComponents.order);

    return {
      id: bp.id,
      name: bp.name,
      description: bp.description,
      tags: bp.tags ?? [],
      category: bp.category,
      isComposed: bp.isComposed,
      status: bp.status,
      repoUrl: bp.repoUrl,
      latestRevision: latestRev
        ? {
            id: latestRev.id,
            version: latestRev.version,
            contractContent: latestRev.contractContent,
            contentHash: latestRev.contentHash,
            createdAt: latestRev.createdAt.toISOString(),
          }
        : null,
      revisions: revisions.map((r) => ({
        id: r.id,
        version: r.version,
        contentHash: r.contentHash,
        createdAt: r.createdAt.toISOString(),
      })),
      components: components.map((c) => ({
        id: c.id,
        componentTemplateId: c.componentTemplateId,
        order: c.order,
        configOverrides: c.configOverrides,
        name: c.name,
        slug: c.slug,
        priceAmount: c.priceAmount,
      })),
      createdAt: bp.createdAt.toISOString(),
      updatedAt: bp.updatedAt.toISOString(),
    };
  }

  /** PUT /studio/blueprints/:id — modifier le blueprint (crée une nouvelle révision) */
  @Put('blueprints/:id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBlueprintDto,
    @Req() req: TenantRequest,
  ) {
    const ctx = req.tenant;

    const [bp] = await this.db
      .select()
      .from(templateBlueprints)
      .where(
        and(
          eq(templateBlueprints.id, id),
          eq(templateBlueprints.orgId, ctx.org_id),
        ),
      )
      .limit(1);

    if (!bp) throw new NotFoundException('Blueprint introuvable.');
    if (bp.status === 'certified') {
      throw new ForbiddenException('Un blueprint certifié ne peut plus être modifié.');
    }

    let newRevisionId: string | null = null;

    await withTenantTx(this.db, ctx, async (tx) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updates['name'] = body.name.trim();
      if (body.description !== undefined) updates['description'] = body.description.trim();
      if (body.tags !== undefined) updates['tags'] = body.tags;

      if (body.contractContent !== undefined) {
        // Calcule la prochaine version
        const [lastRev] = await tx
          .select({ version: templateRevisions.version })
          .from(templateRevisions)
          .where(eq(templateRevisions.blueprintId, id))
          .orderBy(desc(templateRevisions.version))
          .limit(1);

        const nextVersion = (lastRev?.version ?? 0) + 1;
        const hash = createHash('sha256').update(body.contractContent).digest('hex');

        const [rev] = await tx
          .insert(templateRevisions)
          .values({
            blueprintId: id,
            version: nextVersion,
            contractContent: body.contractContent,
            contentHash: hash,
            authorId: ctx.user_id,
          })
          .returning({ id: templateRevisions.id });

        newRevisionId = rev!.id;
        updates['latestRevisionId'] = newRevisionId;
      }

      await tx
        .update(templateBlueprints)
        .set(updates)
        .where(eq(templateBlueprints.id, id));
    });

    return { id, newRevisionId };
  }

  /** POST /studio/blueprints/:id/submit — soumettre pour certification */
  @Post('blueprints/:id/submit')
  async submit(@Param('id') id: string, @Req() req: TenantRequest) {
    const ctx = req.tenant;

    const [bp] = await this.db
      .select()
      .from(templateBlueprints)
      .where(
        and(
          eq(templateBlueprints.id, id),
          eq(templateBlueprints.orgId, ctx.org_id),
        ),
      )
      .limit(1);

    if (!bp) throw new NotFoundException('Blueprint introuvable.');
    if (!bp.latestRevisionId) {
      throw new BadRequestException('Le blueprint doit avoir au moins une révision avant soumission.');
    }
    if (bp.status !== 'draft' && bp.status !== 'rejected') {
      throw new BadRequestException(`Statut actuel "${bp.status}" ne permet pas la soumission.`);
    }

    await withTenantTx(this.db, ctx, (tx) =>
      tx
        .update(templateBlueprints)
        .set({ status: 'submitted', updatedAt: new Date() })
        .where(eq(templateBlueprints.id, id)),
    );

    return { id, status: 'submitted' };
  }

  /** POST /studio/blueprints/:id/components — ajouter un composant (template de référence) */
  @Post('blueprints/:id/components')
  async addComponent(
    @Param('id') id: string,
    @Body() body: AddComponentDto,
    @Req() req: TenantRequest,
  ) {
    const ctx = req.tenant;

    const [bp] = await this.db
      .select({ id: templateBlueprints.id, orgId: templateBlueprints.orgId })
      .from(templateBlueprints)
      .where(
        and(
          eq(templateBlueprints.id, id),
          eq(templateBlueprints.orgId, ctx.org_id),
        ),
      )
      .limit(1);

    if (!bp) throw new NotFoundException('Blueprint introuvable.');

    const [tpl] = await this.db
      .select({ id: templates.id })
      .from(templates)
      .where(eq(templates.id, body.componentTemplateId))
      .limit(1);

    if (!tpl) throw new NotFoundException('Template composant introuvable.');

    const [comp] = await this.db
      .insert(templateComponents)
      .values({
        parentBlueprintId: id,
        componentTemplateId: body.componentTemplateId,
        order: body.order ?? 0,
        configOverrides: body.configOverrides ?? null,
      })
      .returning({ id: templateComponents.id });

    // Marque le blueprint comme composé
    await this.db
      .update(templateBlueprints)
      .set({ isComposed: true, updatedAt: new Date() })
      .where(eq(templateBlueprints.id, id));

    return { id: comp!.id };
  }

  /** DELETE /studio/blueprints/:id/components/:componentId — retirer un composant */
  @Delete('blueprints/:id/components/:componentId')
  async removeComponent(
    @Param('id') id: string,
    @Param('componentId') componentId: string,
    @Req() req: TenantRequest,
  ) {
    const ctx = req.tenant;

    const [bp] = await this.db
      .select({ id: templateBlueprints.id })
      .from(templateBlueprints)
      .where(
        and(
          eq(templateBlueprints.id, id),
          eq(templateBlueprints.orgId, ctx.org_id),
        ),
      )
      .limit(1);

    if (!bp) throw new NotFoundException('Blueprint introuvable.');

    await this.db
      .delete(templateComponents)
      .where(
        and(
          eq(templateComponents.id, componentId),
          eq(templateComponents.parentBlueprintId, id),
        ),
      );

    return { success: true };
  }

  /**
   * POST /studio/generate
   * Génère un gamad.json via IA (claude-opus-4-8).
   * Prérequis : abonnement actif sur l'org (subscription.status = 'active').
   * Log d'usage inséré dans ai_generation_logs (INV-04).
   */
  @Post('generate')
  async generate(@Body() body: GenerateTemplateDto, @Req() req: TenantRequest) {
    const ctx = req.tenant;

    if (!body.description?.trim()) {
      throw new BadRequestException('La description est requise.');
    }

    // Vérification abonnement actif (INV-06 : orgId côté serveur).
    const [sub] = await this.db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.orgId, ctx.org_id))
      .limit(1);

    if (!sub || sub.status !== 'active') {
      throw new HttpException(
        'Un abonnement actif est requis pour utiliser le Studio IA.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Vérification blueprintId appartient à l'org si fourni.
    if (body.blueprintId) {
      const [bp] = await this.db
        .select({ id: templateBlueprints.id })
        .from(templateBlueprints)
        .where(and(eq(templateBlueprints.id, body.blueprintId), eq(templateBlueprints.orgId, ctx.org_id)))
        .limit(1);
      if (!bp) throw new NotFoundException('Blueprint introuvable.');
    }

    let result;
    try {
      result = await this.aiGenerator.generateTemplate({
        description: body.description,
        category: body.category,
        ...(body.referenceTemplates ? { referenceTemplates: body.referenceTemplates } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur IA.';
      throw new InternalServerErrorException(`Génération échouée : ${msg}`);
    }

    // Log INSERT-only (INV-04) — withTenantTx pour RLS.
    await withTenantTx(this.db, ctx, async (tx) => {
      await tx.insert(aiGenerationLogs).values({
        orgId: ctx.org_id,
        userId: ctx.user_id,
        blueprintId: body.blueprintId ?? null,
        prompt: body.description,
        modelId: result.modelId,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        creditCost: 0,
      });
    });

    return {
      contractContent: result.contractContent,
      explanation: result.explanation,
      tokensUsed: result.tokensInput + result.tokensOutput,
    };
  }
}
