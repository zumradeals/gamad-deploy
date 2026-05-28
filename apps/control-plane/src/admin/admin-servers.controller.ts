// AdminServersController — agents & serveurs cross-tenant (Phase 3, superadmin).
// Lectures directes sans withTenantTx — INV-06 respecté via AdminGuard (rôle lu en base).
// isStale calculé côté serveur : lastSeenAt null ou > 15 minutes.
// AVERTISSEMENT INV sécurité : agentToken retourné EN CLAIR uniquement à la création (POST).

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
  ForbiddenException,
} from '@nestjs/common';
import { Inject, Logger } from '@nestjs/common';
import { count, sql, eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  servers,
  organizations,
  projects,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';

const STALE_THRESHOLD_MINUTES = 15;

interface CreateServerBody {
  name: string;
  host: string;
  agentPort: number;
  orgId: string;
  provider?: 'hetzner' | 'ovh' | 'digitalocean' | 'custom';
  region?: string;
}

interface UpdateServerBody {
  name?: string;
  host?: string;
  agentPort?: number;
}

@Controller('admin/servers')
@UseGuards(AdminGuard)
export class AdminServersController {
  private readonly logger = new Logger(AdminServersController.name);

  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/servers — liste complète des serveurs cross-tenant (sans pagination).
   * isStale = lastSeenAt null ou plus vieux que 15 minutes.
   * projectsCount = nombre de projets associés au serveur.
   */
  @Get()
  async listServers() {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    // Nombre de projets par serveur
    const projectCountsRows = await this.db
      .select({
        serverId: projects.serverId,
        nb: count(),
      })
      .from(projects)
      .groupBy(projects.serverId);

    const projectCountMap = new Map<string, number>();
    for (const row of projectCountsRows) {
      if (row.serverId) {
        projectCountMap.set(row.serverId, Number(row.nb));
      }
    }

    const rows = await this.db
      .select({
        id: servers.id,
        name: servers.name,
        host: servers.host,
        agentPort: servers.agentPort,
        status: servers.status,
        agentVersion: servers.agentVersion,
        lastSeenAt: servers.lastSeenAt,
        orgId: servers.orgId,
        orgName: organizations.name,
      })
      .from(servers)
      .innerJoin(organizations, eq(servers.orgId, organizations.id))
      .orderBy(sql`${servers.createdAt} DESC`);

    const data = rows.map((row) => ({
      ...row,
      isStale:
        row.lastSeenAt === null ||
        new Date(row.lastSeenAt).getTime() < staleThreshold.getTime(),
      projectsCount: projectCountMap.get(row.id) ?? 0,
    }));

    return { data };
  }

  /**
   * POST /admin/servers — créer un serveur VPS.
   * Génère un agentToken aléatoire (64 chars hex). C'est la SEULE fois où ce token
   * est retourné en clair. Ne jamais logger le token (INV sécurité).
   * INV-05 : UUID auto-généré par la BDD.
   */
  @Post()
  async createServer(@Body() body: CreateServerBody) {
    if (!body.name || typeof body.name !== 'string') {
      throw new BadRequestException('Le champ "name" est requis.');
    }
    if (!body.host || typeof body.host !== 'string') {
      throw new BadRequestException('Le champ "host" est requis.');
    }
    if (!body.orgId || typeof body.orgId !== 'string') {
      throw new BadRequestException('Le champ "orgId" est requis.');
    }
    if (body.agentPort !== undefined) {
      const port = Number(body.agentPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new BadRequestException('agentPort doit être un entier entre 1 et 65535.');
      }
    }

    const [org] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, body.orgId))
      .limit(1);

    if (!org) {
      throw new NotFoundException('Organisation introuvable.');
    }

    // Génération du token — 32 bytes = 64 chars hex. JAMAIS loggé.
    const agentToken = crypto.randomBytes(32).toString('hex');

    this.logger.warn(
      `Création serveur "${body.name}" pour org ${body.orgId} — agentToken généré (non loggé, retourné une seule fois).`,
    );

    const insertedRows = await this.db
      .insert(servers)
      .values({
        orgId: body.orgId,
        name: body.name.trim(),
        host: body.host.trim(),
        agentPort: body.agentPort ?? 7500,
        agentToken,
        provider: body.provider ?? null,
        region: body.region ?? null,
        status: 'provisioning',
      })
      .returning({
        id: servers.id,
        name: servers.name,
        host: servers.host,
        agentPort: servers.agentPort,
      });

    const inserted = insertedRows[0];
    if (!inserted) {
      throw new Error('Échec de l\'insertion serveur.');
    }

    // agentToken retourné ici uniquement — cette donnée ne sera plus accessible.
    return {
      id: inserted.id,
      name: inserted.name,
      host: inserted.host,
      agentPort: inserted.agentPort,
      agentToken,
    };
  }

  /**
   * PATCH /admin/servers/:id — modifier name, host et/ou agentPort.
   */
  @Patch(':id')
  async updateServer(
    @Param('id') id: string,
    @Body() body: UpdateServerBody,
  ) {
    const [server] = await this.db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, id))
      .limit(1);

    if (!server) {
      throw new NotFoundException('Serveur introuvable.');
    }

    const updates: Partial<typeof servers.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        throw new BadRequestException('Le champ "name" ne peut pas être vide.');
      }
      updates.name = body.name.trim();
    }
    if (body.host !== undefined) {
      if (typeof body.host !== 'string' || body.host.trim().length === 0) {
        throw new BadRequestException('Le champ "host" ne peut pas être vide.');
      }
      updates.host = body.host.trim();
    }
    if (body.agentPort !== undefined) {
      const port = Number(body.agentPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new BadRequestException('agentPort doit être un entier entre 1 et 65535.');
      }
      updates.agentPort = port;
    }

    if (Object.keys(updates).length === 1) {
      throw new BadRequestException('Aucun champ à modifier fourni (name, host, agentPort).');
    }

    const updatedRows = await this.db
      .update(servers)
      .set(updates)
      .where(eq(servers.id, id))
      .returning({
        id: servers.id,
        name: servers.name,
        host: servers.host,
        agentPort: servers.agentPort,
        status: servers.status,
        updatedAt: servers.updatedAt,
      });

    const updated = updatedRows[0];
    if (!updated) {
      throw new NotFoundException('Serveur introuvable après mise à jour.');
    }

    return {
      id: updated.id,
      name: updated.name,
      host: updated.host,
      agentPort: updated.agentPort,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * DELETE /admin/servers/:id — suppression.
   * Refuse s'il y a des projets actifs liés (status != 'paused' et status != 'failed').
   */
  @Delete(':id')
  async deleteServer(@Param('id') id: string) {
    const [server] = await this.db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, id))
      .limit(1);

    if (!server) {
      throw new NotFoundException('Serveur introuvable.');
    }

    const serverProjects = await this.db
      .select({ status: projects.status })
      .from(projects)
      .where(eq(projects.serverId, id));

    const blockedStatuses = ['pending', 'deploying', 'live'];
    const activeCount = serverProjects.filter((p) =>
      blockedStatuses.includes(p.status),
    ).length;

    if (activeCount > 0) {
      throw new ForbiddenException('Serveur a des projets actifs.');
    }

    await this.db.delete(servers).where(eq(servers.id, id));

    return { deleted: true };
  }
}
