import { useRef, useEffect } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Building2, Key, Bell, AlertTriangle, Github } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useSettingsStore } from '@/store/settings.store';
import { useProfileQuery, useOrgSettingsQuery, useNotificationsQuery } from '@/api/settings';

const NAV_ITEMS = [
  { to: '/app/settings/profile', icon: User, labelKey: 'nav.profile' },
  { to: '/app/settings/organization', icon: Building2, labelKey: 'nav.organization' },
  { to: '/app/settings/github', icon: Github, labelKey: 'nav.github' },
  { to: '/app/settings/api-keys', icon: Key, labelKey: 'nav.apiKeys' },
  { to: '/app/settings/notifications', icon: Bell, labelKey: 'nav.notifications' },
  { to: '/app/settings/danger', icon: AlertTriangle, labelKey: 'nav.danger' },
] as const;

function SettingsSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-4xl animate-pulse">
      <div className="hidden lg:flex flex-col gap-1 w-44 shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-[--border]" />
        ))}
      </div>
      <div className="flex-1 space-y-4">
        <div className="h-7 w-40 rounded bg-[--border]" />
        <div className="h-48 rounded-lg bg-[--border]" />
      </div>
    </div>
  );
}

export function SettingsLayout() {
  const { t } = useTranslation('settings');
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { isLoaded, load, reset } = useSettingsStore();
  const hasLoaded = useRef(false);

  const profileQ = useProfileQuery();
  const orgQ = useOrgSettingsQuery(currentOrgId);
  const notifQ = useNotificationsQuery(currentOrgId);

  // Reset store on unmount so next visit gets fresh data
  useEffect(() => {
    return () => {
      hasLoaded.current = false;
      reset();
    };
  }, [reset]);

  // Populate store once all three queries are settled (success OR error)
  useEffect(() => {
    if (hasLoaded.current) return;
    const allSettled = !profileQ.isPending && !orgQ.isPending && !notifQ.isPending;
    if (!allSettled) return;
    hasLoaded.current = true;
    load({
      profile: profileQ.data ?? { id: '', name: '', email: '', pendingEmail: null, avatarUrl: null, language: 'fr' as const, theme: 'system' as const, platformRole: 'user' as const },
      org: orgQ.data ?? { id: currentOrgId ?? '', name: '', slug: '', plan: 'free' as const },
      notifications: notifQ.data ?? { deploySuccess: true, deployFailed: true, rollback: true, renewalUpcoming: false, webhookUrl: '' },
    });
  }, [profileQ.isPending, profileQ.data, orgQ.isPending, orgQ.data, notifQ.isPending, notifQ.data, currentOrgId, load]);

  if (!isLoaded) return <SettingsSkeleton />;

  return (
    <div className="max-w-4xl">
      {/* Mobile: horizontal tab bar */}
      <nav className="flex lg:hidden overflow-x-auto gap-1 mb-6 pb-2">
        {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-[rgba(16,185,129,0.12)] text-[--accent] font-medium'
                  : 'text-[--text-muted] hover:bg-[rgba(16,185,129,0.06)] hover:text-[--text]',
              )
            }
          >
            <Icon size={14} />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="flex gap-8">
        {/* Desktop: vertical sidebar */}
        <nav className="hidden lg:flex flex-col gap-1 w-44 shrink-0 pt-1">
          {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-[rgba(16,185,129,0.12)] text-[--accent] font-medium'
                    : 'text-[--text-muted] hover:bg-[rgba(16,185,129,0.06)] hover:text-[--text]',
                  labelKey === 'nav.danger' && 'text-red-500 hover:text-red-500 hover:bg-red-500/10',
                )
              }
            >
              <Icon size={15} />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

// Default redirect from /app/settings → /app/settings/profile
export function SettingsIndexRedirect() {
  return <Navigate to="/app/settings/profile" replace />;
}
