import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/lib/i18n';
import './index.css';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Élément #root introuvable dans le DOM.");

ReactDOM.createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
