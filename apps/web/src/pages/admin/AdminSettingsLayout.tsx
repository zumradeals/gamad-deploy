// AdminSettingsLayout — sous-layout avec onglets verticaux pour les settings admin.

import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { Palette, ToggleRight, Sliders, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/admin/settings/branding', icon: Palette, label: 'Branding' },
  { to: '/admin/settings/features', icon: ToggleRight, label: 'Fonctionnalités' },
  { to: '/admin/settings/limits', icon: Sliders, label: 'Limites' },
  { to: '/admin/settings/maintenance', icon: AlertOctagon, label: 'Maintenance' },
] as const;

export function AdminSettingsLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Paramètres</h1>
        <p className="text-sm text-gray-400 mt-1">Configuration globale de la plateforme</p>
      </div>

      <div className="flex gap-6">
        {/* Onglets verticaux */}
        <nav className="flex flex-col gap-0.5 w-44 shrink-0">
          {TABS.map(({ to, icon: Icon, label }) => (
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

        {/* Contenu de l'onglet actif */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function AdminSettingsIndexRedirect() {
  return <Navigate to="/admin/settings/branding" replace />;
}
