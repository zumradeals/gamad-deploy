import { Controller, Get, Inject, Req, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AuthorizationHelper } from '../persistence/authorization';
import type { TenantRequest } from '../persistence/tenant-middleware';

@Controller('users')
export class UserController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: NodePgDatabase,
    private readonly authHelper: AuthorizationHelper,
  ) {}

  @Get('me')
  async getMe(@Req() req: TenantRequest) {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, req.tenant.user_id))
      .limit(1);

    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    // Rôle plateforme lu en base — jamais depuis le JWT (INV-06)
    const platformRole = await this.authHelper.getPlatformRole(req.tenant);

    return {
      id: user.id,
      name: user.fullName ?? user.email,
      email: user.email,
      pendingEmail: null,
      avatarUrl: null,
      language: 'fr',
      theme: 'system',
      platformRole: platformRole ?? 'user',
    };
  }
}
