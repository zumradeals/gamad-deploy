import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/lib/i18n';
import './index.css';
import { App } from './App';
import { ApiError } from '@/api/client';
import type { PlatformSetting } from '@/api/admin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Ne jamais retenter les erreurs client (4xx) — seules les erreurs serveur (5xx)
      // méritent un retry. Sans ça, chaque 404 ajoute ~1s de délai (backoff exponentiel).
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});

/**
 * Charge le branding depuis /api/admin/settings (route publique) et injecte
 * les CSS variables pour que la couleur principale soit correcte avant le premier rendu.
 * Non-bloquant : en cas d'erreur réseau, les valeurs CSS par défaut s'appliquent.
 */
async function applyBranding(): Promise<void> {
  try {
    const res = await fetch('/api/admin/settings');
    if (!res.ok) return;
    const settings = await res.json() as PlatformSetting[];
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    if (map['primary_color']) {
      document.documentElement.style.setProperty('--accent', map['primary_color']);
    }
    if (map['secondary_color']) {
      document.documentElement.style.setProperty('--accent-secondary', map['secondary_color']);
    }
  } catch {
    // Silencieux — ne pas bloquer l'app si le serveur est inaccessible
  }
}

// Branding appliqué de façon non-bloquante avant le montage React
void applyBranding();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Élément #root introuvable dans le DOM.");

ReactDOM.createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
