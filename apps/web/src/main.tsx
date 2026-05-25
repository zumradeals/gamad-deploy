import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/lib/i18n';
import './index.css';
import { App } from './App';
import { ApiError } from '@/api/client';

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

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Élément #root introuvable dans le DOM.");

ReactDOM.createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
