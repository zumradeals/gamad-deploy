// AdminController — routes superadmin cross-tenant (INV-06 : rôle lu en base via AdminGuard).
// Ces routes ne passent PAS par withTenantTx — elles font des lectures cross-tenant directes.
// GET /admin/settings est public (sans JWT) pour charger le branding avant login.

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Inject } from '@nestjs/common';
import { eq, and, count, sql } from 'drizzle-orm';
import { writeFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  users,
  organizations,
  servers,
  deployments,
  paymentTransactions,
  platformSettings,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';
import type { TenantRequest } from '../persistence/tenant-middleware';

const UPLOAD_DIR = '/opt/gamad-deploy/uploads';
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

interface UpdateSettingsBody {
  settings: Record<string, string>;
}

@Controller('admin')
export class AdminController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/overview — métriques globales cross-tenant (guard superadmin).
   * Retourne : users, orgs, servers, deployments, revenue.
   */
  @Get('overview')
  @UseGuards(AdminGuard)
  async getOverview() {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Comptages en parallèle pour minimiser la latence
    const [
      [totalUsersRow],
      [newUsersRow],
      [totalOrgsRow],
      serverRows,
      deploymentRows,
      [revenueRow],
    ] = await Promise.all([
      // Total utilisateurs
      this.db.select({ total: count() }).from(users),
      // Nouveaux utilisateurs ce mois-ci
      this.db
        .select({ total: count() })
        .from(users)
        .where(sql`${users.createdAt} >= ${firstOfMonth}`),
      // Total organisations
      this.db.select({ total: count() }).from(organizations),
      // Serveurs par statut
      this.db
        .select({ status: servers.status, nb: count() })
        .from(servers)
        .groupBy(servers.status),
      // Déploiements par statut
      this.db
        .select({ status: deployments.status, nb: count() })
        .from(deployments)
        .groupBy(deployments.status),
      // Revenus du mois (transactions success)
      this.db
        .select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.status, 'success'),
            sql`${paymentTransactions.createdAt} >= ${firstOfMonth}`,
          ),
        ),
    ]);

    const totalServers = serverRows.reduce((acc, r) => acc + Number(r.nb), 0);
    const readyServers = serverRows.find((r) => r.status === 'ready')?.nb ?? 0;
    const errorServers = serverRows.find((r) => r.status === 'error')?.nb ?? 0;

    const totalDeployments = deploymentRows.reduce((acc, r) => acc + Number(r.nb), 0);
    const runningDeployments = deploymentRows.find((r) => r.status === 'running')?.nb ?? 0;
    const successDeployments = deploymentRows.find((r) => r.status === 'success')?.nb ?? 0;
    const successRate =
      totalDeployments > 0 ? Math.round((Number(successDeployments) / totalDeployments) * 100) / 100 : 0;

    return {
      users: {
        total: Number(totalUsersRow?.total ?? 0),
        thisMonth: Number(newUsersRow?.total ?? 0),
      },
      orgs: {
        total: Number(totalOrgsRow?.total ?? 0),
      },
      servers: {
        total: totalServers,
        ready: Number(readyServers),
        error: Number(errorServers),
      },
      deployments: {
        total: totalDeployments,
        running: Number(runningDeployments),
        successRate,
      },
      revenue: {
        thisMonth: Number(revenueRow?.total ?? 0),
        currency: 'XOF',
      },
    };
  }

  /**
   * GET /admin/settings — toutes les platform_settings.
   * Route PUBLIQUE (pas de guard) pour charger le branding avant login.
   */
  @Get('settings')
  async getSettings() {
    const rows = await this.db
      .select({
        key: platformSettings.key,
        value: platformSettings.value,
        valueType: platformSettings.valueType,
        category: platformSettings.category,
      })
      .from(platformSettings)
      .orderBy(platformSettings.category, platformSettings.key);

    return rows;
  }

  /**
   * PATCH /admin/settings — mettre à jour une ou plusieurs settings (guard superadmin).
   * Body : { settings: { "platform_name": "Mon Déployeur", ... } }
   */
  @Patch('settings')
  @UseGuards(AdminGuard)
  async updateSettings(
    @Req() req: TenantRequest,
    @Body() body: UpdateSettingsBody,
  ) {
    if (!body.settings || typeof body.settings !== 'object') {
      throw new BadRequestException('Le corps doit contenir un objet "settings".');
    }

    const entries = Object.entries(body.settings);
    if (entries.length === 0) {
      throw new BadRequestException('Aucune setting fournie.');
    }

    // Vérifier que toutes les clés existent
    for (const [key, value] of entries) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new BadRequestException(`Clé ou valeur invalide : ${String(key)}`);
      }
      const [existing] = await this.db
        .select({ id: platformSettings.id })
        .from(platformSettings)
        .where(eq(platformSettings.key, key))
        .limit(1);
      if (!existing) {
        throw new NotFoundException(`Setting inconnue : ${key}`);
      }
      await this.db
        .update(platformSettings)
        .set({ value, updatedAt: new Date(), updatedBy: req.tenant.user_id })
        .where(eq(platformSettings.key, key));
    }

    return { updated: entries.length };
  }

  /**
   * POST /admin/settings/logo — upload logo (guard superadmin).
   * Multipart/form-data, champ "file". Valide extension + taille.
   * Sauvegarde dans /opt/gamad-deploy/uploads/logo.<ext>.
   * Met à jour logo_url en base.
   */
  @Post('settings/logo')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Req() req: TenantRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni (champ "file").');
    }

    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        `Extension non autorisée : ${ext}. Accepté : jpg, png, webp, svg.`,
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('Fichier trop lourd (max 2 Mo).');
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `logo${ext}`;
    const filePath = join(UPLOAD_DIR, fileName);
    await writeFile(filePath, file.buffer);

    const logoUrl = `/uploads/${fileName}`;
    await this.db
      .update(platformSettings)
      .set({ value: logoUrl, updatedAt: new Date(), updatedBy: req.tenant.user_id })
      .where(eq(platformSettings.key, 'logo_url'));

    return { logoUrl };
  }
}
