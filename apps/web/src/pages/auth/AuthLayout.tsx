import { Outlet, Link } from 'react-router-dom';
import { Toaster } from '@/components/ui/toast';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[--bg] px-4 py-12">
      <Link to="/" className="mb-8 flex items-center gap-2 font-display text-xl font-bold text-[--text]">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[--accent] text-white text-sm font-bold">G</span>
        <span>GAMAD<span className="text-[--accent]"> Deploy</span></span>
      </Link>
      <Outlet />
      <Toaster richColors position="top-right" />
    </div>
  );
}
