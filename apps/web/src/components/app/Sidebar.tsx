import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, FolderGit2, Server, CreditCard, Settings, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

interface NavItem {
  to: string;
  icon: React.ElementType;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/app/projects', icon: FolderGit2, labelKey: 'nav.projects' },
  { to: '/app/servers', icon: Server, labelKey: 'nav.servers' },
  { to: '/app/billing', icon: CreditCard, labelKey: 'nav.billing' },
  { to: '/app/settings', icon: Settings, labelKey: 'nav.settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation('dashboard');
  const logout = useAuthStore((s) => s.logout);
  const platformRole = useAuthStore((s) => s.platformRole);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[--surface] border-r border-[--border]',
        'transition-transform duration-200',
        'lg:static lg:translate-x-0 lg:z-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-[--border]">
        <div className="flex items-center gap-2 font-display text-base font-bold text-[--text]">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[--accent] text-white text-xs font-bold">
            G
          </span>
          <span>GAMAD<span className="text-[--accent]"> Deploy</span></span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden rounded p-1 text-[--text-muted] hover:text-[--text] transition-colors"
          aria-label="Fermer le menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-[rgba(16,185,129,0.12)] text-[--accent] font-medium'
                  : 'text-[--text-muted] hover:bg-[rgba(16,185,129,0.06)] hover:text-[--text]',
              )
            }
          >
            <Icon size={17} />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* Admin link — visible uniquement si superadmin */}
      {platformRole === 'superadmin' && (
        <div className="px-3 pb-2">
          <NavLink
            to="/admin/overview"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 font-medium'
                  : 'text-[--text-muted] hover:bg-[rgba(16,185,129,0.06)] hover:text-[--text]',
              )
            }
          >
            <ShieldCheck size={17} />
            Administration
          </NavLink>
        </div>
      )}

      {/* Bottom section */}
      <div className="border-t border-[--border] p-3 space-y-2">
        <div className="rounded-lg bg-[rgba(16,185,129,0.06)] px-3 py-2">
          <p className="text-[10px] font-medium text-[--text-muted] uppercase tracking-wide">
            {t('plan.label')}
          </p>
          <p className="text-sm font-semibold text-[--accent] mt-0.5">Free</p>
        </div>
        <button
          onClick={logout}
          className="w-full text-left rounded-lg px-3 py-2 text-xs text-[--text-muted] hover:text-[--text] hover:bg-[rgba(16,185,129,0.06)] transition-colors"
        >
          {t('user.logout')}
        </button>
      </div>
    </aside>
  );
}
