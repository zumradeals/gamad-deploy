// TenantMiddleware — résolution du tenant courant depuis le JWT (INV-06, C-10)
// RÈGLE ABSOLUE : seuls org_id et user_id sont extraits du JWT.
// Le rôle (org_role, platform_role) n'est JAMAIS lu depuis le JWT — vérifié en base (INV-06).
// La portée tenant est injectée par l'infrastructure, jamais fournie par le client.

import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { TenantContext } from '@gamad/contracts';

/** Étend Express.Request pour porter le contexte tenant résolu. */
export interface TenantRequest extends Request {
  tenant: TenantContext;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: TenantRequest, _res: Response, next: NextFunction): void {
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

    req.tenant = { org_id: orgId, user_id: userId };
    next();
  }
}
