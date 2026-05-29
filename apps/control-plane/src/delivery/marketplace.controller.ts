// MarketplaceController — Couche Delivery (C-12).
// Routes publiques (GET sans auth) et authentifiées (POST avec TenantMiddleware).
// INV-06 : tenant injecté côté serveur, jamais depuis le client.
// INV-04 : template_purchases INSERT-only — jamais UPDATE/DELETE.
// INV-02 : contractContent présent → rawContract transmis au pipeline.

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, count, sql, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Queue } from 'bullmq';
import {
  templates,
  templatePurchases,
  organizations,
  withTenantTx,
  deployments,
  projects,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import {
  PIPELINE_QUEUE_TOKEN,
  JobName,
  DEFAULT_JOB_OPTIONS,
} from '../orchestration/pipeline/pipeline.constants';
import type { PipelineJobData } from '../orchestration/pipeline/pipeline.types';
import type { TenantRequest } from '../persistence/tenant-middleware';
import type { BillingService } from '../domain/billing/billing.service';

export const BILLING_SERVICE_TOKEN = 'BILLING_SERVICE';

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: NodePgDatabase,
    @Inject(PIPELINE_QUEUE_TOKEN) private readonly queue: Queue,
    @Inject('BillingService') private readonly billing: BillingService,
  ) {}

  /** GET /marketplace — catalogue public (templates certified + published) */
  @Get()
  async listPublic() {
    const rows = await this.db
      .select({
        id: templates.id,
        name: templates.name,
        slug: templates.slug,
        description: templates.description,
        tags: templates.tags,
        priceAmount: templates.priceAmount,
        currency: sql<string>`'XOF'`,
        repoUrl: templates.repoUrl,
        marketplaceLevel: templates.marketplaceLevel,
        ownerOrgId: templates.ownerOrgId,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(
        and(
          eq(templates.marketplaceLevel, 'certified'),
          eq(templates.isPublished, true),
        ),
      );

    // Calcul usageCount par template (uniquement pour les templates listés)
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

    // Récupération des noms d'organisations propriétaires
    const orgIds = [...new Set(rows.map((r) => r.ownerOrgId).filter(Boolean))] as string[];
    const orgNames = orgIds.length > 0
      ? await this.db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, orgIds))
      : [];
    const orgMap = new Map<string, string>(orgNames.map((o) => [o.id, o.name]));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      tags: r.tags ?? [],
      priceAmount: r.priceAmount,
      currency: r.currency,
      repoUrl: r.repoUrl,
      marketplaceLevel: r.marketplaceLevel,
      ownerOrgName: r.ownerOrgId ? (orgMap.get(r.ownerOrgId) ?? '') : '',
      usageCount: usageMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** GET /marketplace/:slug — détail public + hasAccess (boolean) */
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string, @Req() req: Partial<TenantRequest>) {
    const [row] = await this.db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.slug, slug),
          eq(templates.marketplaceLevel, 'certified'),
          eq(templates.isPublished, true),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Template introuvable.');

    const [usageRow] = await this.db
      .select({ cnt: count(templatePurchases.id) })
      .from(templatePurchases)
      .where(eq(templatePurchases.templateId, row.id));

    // hasAccess : gratuit OU acheté par l'organisation courante
    // Si pas de JWT (req.tenant absent) → hasAccess=false sans exception (INV-06)
    let hasAccess = row.priceAmount === 0;
    if (!hasAccess && req.tenant?.org_id) {
      const [purchased] = await this.db
        .select({ id: templatePurchases.id })
        .from(templatePurchases)
        .where(
          and(
            eq(templatePurchases.templateId, row.id),
            eq(templatePurchases.orgId, req.tenant.org_id),
          ),
        )
        .limit(1);
      hasAccess = !!purchased;
    }

    const [org] = row.ownerOrgId
      ? await this.db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, row.ownerOrgId))
          .limit(1)
      : [];

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      tags: row.tags ?? [],
      priceAmount: row.priceAmount,
      currency: 'XOF',
      repoUrl: row.repoUrl,
      marketplaceLevel: row.marketplaceLevel,
      ownerOrgName: org?.name ?? '',
      usageCount: Number(usageRow?.cnt ?? 0),
      createdAt: row.createdAt.toISOString(),
      hasAccess,
      // contractContent exposé pour le wizard (pré-remplissage env vars).
      contractContent: row.contractContent,
    };
  }

  /** POST /marketplace/:id/purchase — achète un template (authentifié) */
  @Post(':id/purchase')
  async purchase(
    @Param('id') id: string,
    @Body() body: PurchaseDto,
    @Req() req: TenantRequest,
  ) {
    const ctx = req.tenant;

    const [template] = await this.db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.id, id),
          eq(templates.marketplaceLevel, 'certified'),
          eq(templates.isPublished, true),
        ),
      )
      .limit(1);

    if (!template) throw new NotFoundException('Template introuvable ou non publié.');

    // Vérifie doublon
    const [alreadyPurchased] = await this.db
      .select({ id: templatePurchases.id })
      .from(templatePurchases)
      .where(
        and(
          eq(templatePurchases.templateId, id),
          eq(templatePurchases.orgId, ctx.org_id),
        ),
      )
      .limit(1);

    if (alreadyPurchased) {
      throw new BadRequestException('Ce template a déjà été acheté par votre organisation.');
    }

    // Template gratuit → INSERT direct + créer déploiement
    if (template.priceAmount === 0) {
      await withTenantTx(this.db, ctx, (tx) =>
        tx.insert(templatePurchases).values({
          orgId: ctx.org_id,
          templateId: id,
          transactionId: null,
        }),
      );

      const deploymentId = await this.createDeploymentFromTemplate(
        ctx,
        template,
        body.serverId,
        body.domain,
        body.httpsEnabled,
      );

      return { deploymentId };
    }

    // Template payant → initTemplatePurchase → paymentUrl
    const baseUrl = process.env['APP_URL'] ?? 'https://deploy.gamad.net';
    const { paymentUrl } = await this.billing.initTemplatePurchase(ctx, {
      templateId: id,
      templateName: template.name,
      amount: template.priceAmount,
      customer: { id: ctx.user_id },
      returnUrl: `${baseUrl}/app/marketplace/${template.slug}`,
      notifyUrl: `${baseUrl}/api/webhooks/geniuspay`,
      serverId: body.serverId,
      domain: body.domain ?? '',
      httpsEnabled: body.httpsEnabled,
    });

    return { paymentUrl };
  }

  /** POST /marketplace/:id/deploy — déploie un template déjà accessible (authentifié) */
  @Post(':id/deploy')
  async deploy(
    @Param('id') id: string,
    @Body() body: DeployDto,
    @Req() req: TenantRequest,
  ) {
    const ctx = req.tenant;

    const [template] = await this.db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);

    if (!template) throw new NotFoundException('Template introuvable.');

    if (!template.contractContent) {
      throw new BadRequestException(
        'Ce template ne dispose pas encore de contrat certifié (contract_content null).',
      );
    }

    // Vérifie l'accès (gratuit ou acheté)
    const hasAccess = template.priceAmount === 0 || await this.checkAccess(ctx.org_id, id);
    if (!hasAccess) throw new ForbiddenException('Accès non autorisé à ce template.');

    const deploymentId = await this.createDeploymentFromTemplate(
      ctx,
      template,
      body.serverId,
      body.domain,
      body.httpsEnabled,
      body.envVars,
    );

    return { deploymentId };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async checkAccess(orgId: string, templateId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: templatePurchases.id })
      .from(templatePurchases)
      .where(
        and(
          eq(templatePurchases.templateId, templateId),
          eq(templatePurchases.orgId, orgId),
        ),
      )
      .limit(1);
    return !!row;
  }

  private async createDeploymentFromTemplate(
    ctx: { org_id: string; user_id: string },
    template: typeof templates.$inferSelect,
    serverId: string,
    domain: string | undefined,
    httpsEnabled: boolean,
    envVarsOverride?: Record<string, string>,
  ): Promise<string> {
    if (!template.contractContent) {
      throw new BadRequestException('contract_content manquant sur ce template.');
    }

    const projectName = template.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Upsert projet (même logique que DeploymentController.launch)
    let projectId: string;
    const [existing] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.orgId, ctx.org_id),
          eq(projects.repoUrl, template.repoUrl),
          eq(projects.serverId, serverId),
        ),
      )
      .limit(1);

    if (existing) {
      projectId = existing.id;
      await this.db
        .update(projects)
        .set({ domain: domain ?? null, enableHttps: httpsEnabled, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    } else {
      const [inserted] = await this.db
        .insert(projects)
        .values({
          orgId: ctx.org_id,
          serverId,
          name: projectName,
          repoUrl: template.repoUrl,
          repoBranch: 'main',
          domain: domain ?? null,
          enableHttps: httpsEnabled,
        })
        .returning({ id: projects.id });
      projectId = inserted!.id;
    }

    // INSERT deployment PENDING
    let deploymentId!: string;
    await withTenantTx(this.db, ctx, async (tx) => {
      const [dep] = await tx
        .insert(deployments)
        .values({
          projectId,
          triggerType: 'manual',
          triggerUserId: ctx.user_id,
          status: 'pending',
          commitSha: null,
        })
        .returning({ id: deployments.id });
      deploymentId = dep!.id;
    });

    // Enqueue resolve-source avec rawContract (INV-02 : chemin A du SourceResolver)
    const jobData: PipelineJobData = {
      deploymentId,
      orgId: ctx.org_id,
      userId: ctx.user_id,
      serverId,
      repoAnalysis: {
        repo_url: template.repoUrl,
        ref: { type: 'branch' as const, value: 'cursor' },
        rawContract: template.contractContent,
        has_gamad_json: true,
        has_dockerfile: false,
        has_compose_file: false,
        detected_framework: '',
        detected_runtime: '',
      },
      ...(domain ? { domain } : {}),
      httpsEnabled,
      ...(envVarsOverride && Object.keys(envVarsOverride).length > 0 ? { envVarsOverride } : {}),
    };

    await this.queue.add(JobName.RESOLVE_SOURCE, jobData, DEFAULT_JOB_OPTIONS);

    return deploymentId;
  }
}

class PurchaseDto {
  serverId!: string;
  domain?: string;
  httpsEnabled!: boolean;
}

class DeployDto {
  serverId!: string;
  domain?: string;
  httpsEnabled!: boolean;
  /** Variables d'environnement configurées par l'utilisateur dans le wizard. */
  envVars?: Record<string, string>;
}
