// TenantMiddleware — résolution du tenant courant depuis le JWT (INV-06, C-10)
// RÈGLE ABSOLUE : seuls org_id et user_id sont extraits du JWT.
// Le rôle (org_role, platform_role) n'est JAMAIS lu depuis le JWT — vérifié en base (INV-06).
// La portée tenant est injectée par l'infrastructure, jamais fournie par le client.
// Vérification suspension : suspended_at IS NOT NULL → UnauthorizedException (migration 0006).

import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TenantContext } from '@gamad/contracts';
import { users } from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';

/** Étend Express.Request pour porter le contexte tenant résolu. */
export interface TenantRequest extends Request {
  tenant: TenantContext;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  async use(req: TenantRequest, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('En-tête Authorization manquant ou mal formé.');
    }

    const token = authHeader.slice(7);
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      // Erreur de configuration serveur — ne jamais exposer le détail au client
      throw new Error('JWT_SECRET non configuré dans les variables d\'environnement.');
    }

    let decoded: Record<string, unknown>;
    try {
      decoded = jwt.verify(token, secret) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('Token JWT invalide ou expiré.');
    }

    // Extraction stricte : org_id + user_id UNIQUEMENT — pas de rôle (INV-06)
    const orgId = decoded['org_id'];
    const userId = decoded['user_id'];

    if (typeof orgId !== 'string' || orgId.length === 0) {
      throw new UnauthorizedException('Claim JWT invalide : org_id manquant ou non string.');
    }
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new UnauthorizedException('Claim JWT invalide : user_id manquant ou non string.');
    }

    // Vérification suspension — lecture en base à chaque requête, pas de cache (INV-06)
    const [userRow] = await this.db
      .select({ suspendedAt: users.suspendedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow?.suspendedAt !== null && userRow?.suspendedAt !== undefined) {
      throw new UnauthorizedException('Compte suspendu.');
    }

    req.tenant = { org_id: orgId, user_id: userId };
    next();
  }
}
