// AdminLayout — layout racine du dashboard superadmin.
// Vérifie platformRole === 'superadmin' dans le store — si non, redirect vers /.
// La sécurité réelle est côté serveur (AdminGuard) : cette vérification n'est qu'UX.

import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, Settings, Shield, Users, Building2, CreditCard, Package, Rocket, Server, Receipt, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { Toaster } from '@/components/ui/toast';
import { useAdminSettings, settingsToMap } from '@/api/admin';

const NAV_ITEMS = [
  { to: '/admin/overview', icon: LayoutDashboard, label: 'Vue d\'ensemble' },
  { to: '/admin/users', icon: Users, label: 'Utilisateurs' },
  { to: '/admin/orgs', icon: Building2, label: 'Organisations' },
  { to: '/admin/plans', icon: CreditCard, label: 'Plans' },
  { to: '/admin/templates', icon: Package, label: 'Templates' },
  { to: '/admin/deployments', icon: Rocket, label: 'Déploiements' },
  { to: '/admin/servers', icon: Server, label: 'Serveurs' },
  { to: '/admin/billing', icon: Receipt, label: 'Facturation' },
  { to: '/admin/audit', icon: ClipboardList, label: 'Audit' },
  { to: '/admin/settings/branding', icon: Settings, label: 'Paramètres' },
] as const;

export function AdminLayout() {
  const platformRole = useAuthStore((s) => s.platformRole);
  const settingsQuery = useAdminSettings();

  // Sécurité UX — la vraie sécurité est côté serveur (AdminGuard, INV-06)
  if (platformRole !== null && platformRole !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const settingsMap = settingsQuery.data ? settingsToMap(settingsQuery.data) : {};
  const platformName = typeof settingsMap['platform_name'] === 'string'
    ? settingsMap['platform_name']
    : 'GAMAD Deploy';
  const logoUrl = typeof settingsMap['logo_url'] === 'string' ? settingsMap['logo_url'] : '';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar admin — dark */}
      <aside className="flex w-56 flex-col bg-gray-900 border-r border-gray-800 shrink-0">
        {/* Header */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-gray-800">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-6 w-6 rounded object-contain" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500 text-white text-xs font-bold">
              G
            </span>
          )}
          <span className="text-sm font-semibold text-white truncate">{platformName}</span>
        </div>

        {/* Badge superadmin */}
        <div className="mx-3 mt-3 flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1.5">
          <Shield size={12} className="text-emerald-400" />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
            Superadmin
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
                )
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Lien retour app */}
        <div className="border-t border-gray-800 p-3">
          <NavLink
            to="/app/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Retour à l'app
          </NavLink>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-gray-950">
        <header className="flex h-14 items-center border-b border-gray-800 px-6">
          <p className="text-sm text-gray-500">Dashboard d'administration</p>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
