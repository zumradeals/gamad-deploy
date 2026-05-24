import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: () => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      setToken: (token) => set({ token }),
      isAuthenticated: () => !!get().token,
      logout: () => set({ token: null }),
    }),
    { name: 'gamad-auth' },
  ),
);
