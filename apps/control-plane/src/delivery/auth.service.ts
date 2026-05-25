import { Injectable, Inject, ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, organizations, organizationMembers } from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';

export interface AuthResult {
  token: string;
  orgId: string;
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  async register(fullName: string, email: string, password: string): Promise<AuthResult> {
    const existing = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) throw new ConflictException('Cet email est déjà utilisé.');

    const passwordHash = await bcrypt.hash(password, 10);
    const insertedUsers = await this.db.insert(users).values({ email, fullName, passwordHash }).returning({ id: users.id });
    const user = insertedUsers[0];
    if (!user) throw new Error('Échec de la création du compte utilisateur.');

    const slug = this.generateSlug(fullName) + '-' + Date.now();
    const orgName = fullName + "'s organization";
    const insertedOrgs = await this.db.insert(organizations).values({ name: orgName, slug }).returning({ id: organizations.id });
    const org = insertedOrgs[0];
    if (!org) throw new Error("Échec de la création de l'organisation.");

    await this.db.insert(organizationMembers).values({ orgId: org.id, userId: user.id, orgRole: 'owner' });

    const token = this.signToken(user.id, org.id);
    return { token, orgId: org.id, userId: user.id };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const [user] = await this.db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email ou mot de passe invalide.');
    }

    const [membership] = await this.db
      .select({ orgId: organizationMembers.orgId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);

    if (!membership) throw new UnauthorizedException('Aucune organisation trouvée pour cet utilisateur.');

    const token = this.signToken(user.id, membership.orgId);
    return { token, orgId: membership.orgId, userId: user.id };
  }

  private signToken(userId: string, orgId: string): string {
    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new Error("JWT_SECRET non configuré dans les variables d'environnement.");
    return jwt.sign({ user_id: userId, org_id: orgId }, secret, { expiresIn: '30d' });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  }
}
