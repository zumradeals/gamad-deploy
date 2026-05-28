// OrgTemplatesController — Couche Delivery, routes /orgs/:orgId/templates.
// Gestion des templates soumis par une organisation (C-12).
// INV-06 : accès vérifié en base via req.tenant.org_id === params.orgId.
// INV-04 : template_purchases INSERT-only, jamais touché ici.
// INV-02 : gamad.json fetché depuis GitHub, validé via ContratRepoSchema, stocké en contractContent.

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { eq, and, count, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { templates, templatePurchases } from '@gamad/schema';
import { ContratRepoSchema } from '@gamad/contracts';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import type { TenantRequest } from '../persistence/tenant-middleware';

@Controller('orgs/:orgId/templates')
export class OrgTemplatesController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /** GET /orgs/:orgId/templates — liste des templates de l'org */
  @Get()
  async list(@Param('orgId') orgId: string, @Req() req: TenantRequest) {
    this.assertOrgAccess(req, orgId);

    const rows = await this.db
      .select({
        id: templates.id,
        name: templates.name,
        slug: templates.slug,
        description: templates.description,
        tags: templates.tags,
        priceAmount: templates.priceAmount,
        marketplaceLevel: templates.marketplaceLevel,
        isPublished: templates.isPublished,
        repoUrl: templates.repoUrl,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(eq(templates.ownerOrgId, orgId));

    // usageCount par template
    const templateIds = rows.map((r) => r.id);
    const usageRows = templateIds.length > 0
      ? await this.db
          .select({
            templateId: templatePurchases.templateId,
            cnt: count(templatePurchases.id),
          })
          .from(templatePurchases)
          .where(inArray(templatePurchases.templateId, templateIds))
          .groupBy(templatePurchases.templateId)
      : [];

    const usageMap = new Map<string, number>(
      usageRows.map((r) => [r.templateId, Number(r.cnt)]),
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      tags: r.tags ?? [],
      priceAmount: r.priceAmount,
      marketplaceLevel: r.marketplaceLevel,
      isPublished: r.isPublished,
      repoUrl: r.repoUrl,
      usageCount: usageMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** POST /orgs/:orgId/templates — soumet un nouveau template */
  @Post()
  async create(
    @Param('orgId') orgId: string,
    @Body() body: CreateTemplateDto,
    @Req() req: TenantRequest,
  ) {
    this.assertOrgAccess(req, orgId);

    // Normalise repoUrl
    const repoUrl = body.repoUrl.replace(/\.git$/, '');
    const githubMatch = /github\.com[/:]([^/]+)\/([^/]+)$/.exec(repoUrl);
    if (!githubMatch) {
      throw new BadRequestException(
        'URL du dépôt invalide. Seuls les dépôts GitHub sont supportés (https://github.com/owner/repo).',
      );
    }

    const [, owner, repo] = githubMatch;
    const branch = 'main';

    // Fetch gamad.json depuis GitHub raw
    let rawContent: string;
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/gamad.json`;
      const res = await fetch(rawUrl, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        throw new BadRequestException(
          `Aucun gamad.json trouvé dans ce dépôt (HTTP ${res.status}). Ajoutez un gamad.json à la racine du dépôt.`,
        );
      }
      rawContent = await res.text();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        `Impossible de contacter GitHub pour lire gamad.json : ${reason}`,
      );
    }

    // Validation du contenu gamad.json
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new BadRequestException('gamad.json invalide : JSON malformé.');
    }

    const result = ContratRepoSchema.safeParse(parsed);
    if (!result.success) {
      throw new BadRequestException(
        `gamad.json invalide : ${result.error.message}`,
      );
    }

    // Hash SHA-256 du contenu brut (INV-04, C-11)
    const contractHash = createHash('sha256').update(rawContent).digest('hex');

    const [inserted] = await this.db
      .insert(templates)
      .values({
        ownerOrgId: orgId,
        name: body.name,
        slug: body.slug,
        repoUrl: body.repoUrl,
        description: body.description ?? '',
        tags: body.tags ?? [],
        priceAmount: body.priceAmount ?? 0,
        contractHash,
        contractContent: rawContent,
        marketplaceLevel: 'draft',
        isPublished: false,
      })
      .returning({
        id: templates.id,
        name: templates.name,
        slug: templates.slug,
        marketplaceLevel: templates.marketplaceLevel,
      });

    return inserted;
  }

  /** PATCH /orgs/:orgId/templates/:templateId — met à jour un template */
  @Patch(':templateId')
  async update(
    @Param('orgId') orgId: string,
    @Param('templateId') templateId: string,
    @Body() body: UpdateTemplateDto,
    @Req() req: TenantRequest,
  ) {
    this.assertOrgAccess(req, orgId);

    const [template] = await this.db
      .select()
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.ownerOrgId, orgId)))
      .limit(1);

    if (!template) throw new NotFoundException('Template introuvable.');

    // isPublished peut passer à true uniquement si marketplaceLevel='certified'
    if (body.isPublished === true && template.marketplaceLevel !== 'certified') {
      throw new BadRequestException(
        'Un template doit être certifié (marketplaceLevel=certified) avant d\'être publié.',
      );
    }

    const updateValues: Partial<typeof templates.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updateValues.name = body.name;
    if (body.description !== undefined) updateValues.description = body.description;
    if (body.tags !== undefined) updateValues.tags = body.tags;
    if (body.priceAmount !== undefined) updateValues.priceAmount = body.priceAmount;
    if (body.isPublished !== undefined) updateValues.isPublished = body.isPublished;

    const [updated] = await this.db
      .update(templates)
      .set(updateValues)
      .where(and(eq(templates.id, templateId), eq(templates.ownerOrgId, orgId)))
      .returning();

    return updated;
  }

  /** DELETE /orgs/:orgId/templates/:templateId — supprime un template non acheté */
  @Delete(':templateId')
  async remove(
    @Param('orgId') orgId: string,
    @Param('templateId') templateId: string,
    @Req() req: TenantRequest,
  ) {
    this.assertOrgAccess(req, orgId);

    const [template] = await this.db
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.ownerOrgId, orgId)))
      .limit(1);

    if (!template) throw new NotFoundException('Template introuvable.');

    // Vérifie usageCount=0 (INV-04 : ne pas casser les achats existants)
    const [usageRow] = await this.db
      .select({ cnt: count(templatePurchases.id) })
      .from(templatePurchases)
      .where(eq(templatePurchases.templateId, templateId));

    if (Number(usageRow?.cnt ?? 0) > 0) {
      throw new ForbiddenException(
        'Ce template a été acheté par des organisations et ne peut pas être supprimé.',
      );
    }

    await this.db
      .delete(templates)
      .where(and(eq(templates.id, templateId), eq(templates.ownerOrgId, orgId)));

    return { success: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private assertOrgAccess(req: TenantRequest, orgId: string): void {
    if (req.tenant.org_id !== orgId) {
      throw new ForbiddenException('Accès refusé : organisation invalide.');
    }
  }
}

class CreateTemplateDto {
  name!: string;
  slug!: string;
  repoUrl!: string;
  description?: string;
  tags?: string[];
  priceAmount?: number;
}

class UpdateTemplateDto {
  name?: string;
  description?: string;
  tags?: string[];
  priceAmount?: number;
  isPublished?: boolean;
}
