import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  currentOrgId: string | null;
  setToken: (token: string | null) => void;
  setCurrentOrgId: (orgId: string | null) => void;
  isAuthenticated: () => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      currentOrgId: null,
      setToken: (token) => set({ token }),
      setCurrentOrgId: (currentOrgId) => set({ currentOrgId }),
      isAuthenticated: () => !!get().token,
      logout: () => set({ token: null, currentOrgId: null }),
    }),
    { name: 'gamad-auth' },
  ),
);
