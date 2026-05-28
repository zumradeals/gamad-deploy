// AdminGuard — vérifie que l'utilisateur est superadmin EN BASE (INV-06).
// Le rôle n'est jamais lu depuis le JWT — AuthorizationHelper fait la requête en base
// à chaque appel. Toute tentative de bypass côté client est inopérante.

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthorizationHelper } from '../persistence/authorization';
import type { TenantRequest } from '../persistence/tenant-middleware';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authHelper: AuthorizationHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    const role = await this.authHelper.getPlatformRole(req.tenant);
    if (role !== 'superadmin') {
      throw new ForbiddenException('Accès réservé aux superadmins.');
    }
    return true;
  }
}
