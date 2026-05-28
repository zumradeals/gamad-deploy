import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PlatformRole = 'superadmin' | 'support' | 'user';

interface AuthState {
  token: string | null;
  currentOrgId: string | null;
  /** Rôle plateforme — chargé depuis GET /users/me (lu en base côté serveur, INV-06). */
  platformRole: PlatformRole | null;
  setToken: (token: string | null) => void;
  setCurrentOrgId: (orgId: string | null) => void;
  setPlatformRole: (role: PlatformRole | null) => void;
  isAuthenticated: () => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      currentOrgId: null,
      platformRole: null,
      setToken: (token) => set({ token }),
      setCurrentOrgId: (currentOrgId) => set({ currentOrgId }),
      setPlatformRole: (platformRole) => set({ platformRole }),
      isAuthenticated: () => !!get().token,
      logout: () => set({ token: null, currentOrgId: null, platformRole: null }),
    }),
    { name: 'gamad-auth' },
  ),
);
