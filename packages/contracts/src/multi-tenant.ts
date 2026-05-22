// C-10 — Modèle multi-tenant & autorisation
// Le tenant courant est résolu côté serveur par TenantMiddleware (JWT + org sélectionnée),
// jamais d'un paramètre client arbitraire (INV-06).
// Le rôle n'est jamais lu depuis le JWT ; il est vérifié en base à chaque requête sensible.
// Une ressource d'une autre org est invisible (404, pas 403).

export type PlatformRole = 'superadmin' | 'support' | 'user';
export type OrgRole = 'owner' | 'admin' | 'member';
export type Plan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface Organization {
  id: string;    // UUID v4 (INV-05)
  name: string;
  slug: string;
  plan: Plan;
  created_at: string; // ISO 8601
}

export interface OrganizationMember {
  org_id: string;  // UUID v4
  user_id: string; // UUID v4
  org_role: OrgRole;
}

export interface UserRole {
  user_id: string; // UUID v4
  role: PlatformRole;
}

/** Injectée côté serveur par TenantMiddleware. Jamais fournie par le client (INV-06). */
export interface TenantContext {
  org_id: string;  // UUID v4
  user_id: string; // UUID v4
}
