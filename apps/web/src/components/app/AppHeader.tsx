import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Sun, Moon, Globe } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth.store';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useOrgs } from '@/api/orgs';

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'nav.dashboard',
  projects: 'nav.projects',
  servers: 'nav.servers',
  billing: 'nav.billing',
  new: 'wizard.title',
};

interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { t, i18n } = useTranslation(['dashboard', 'wizard']);
  const { theme, toggle: toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const location = useLocation();
  const { currentOrgId, setCurrentOrgId } = useAuthStore();
  const { data: orgs } = useOrgs();

  const currentOrg = orgs?.find((o) => o.id === currentOrgId);

  const segments = location.pathname.replace(/^\/app\//, '').split('/').filter(Boolean);
  const breadcrumb = segments.map((seg) => {
    const key = BREADCRUMB_LABELS[seg];
    return key ? t(key) : seg;
  });

  const toggleLang = () => {
    const next = i18n.language.startsWith('fr') ? 'en' : 'fr';
    void i18n.changeLanguage(next);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[--border] bg-[--surface] px-4">
      <button
        onClick={onMenuClick}
        className="lg:hidden rounded p-2 text-[--text-muted] hover:text-[--text] transition-colors"
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <nav className="flex-1 flex items-center gap-1.5 text-sm text-[--text-muted]" aria-label="Fil d'Ariane">
        {breadcrumb.map((label, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[--border]">/</span>}
            <span className={i === breadcrumb.length - 1 ? 'text-[--text] font-medium' : ''}>{label}</span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        {/* Org selector */}
        <DropdownMenu>
          <DropdownMenuTrigger className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[--border] px-3 py-1.5 text-xs text-[--text] hover:bg-[rgba(16,185,129,0.06)] transition-colors">
            <span>{currentOrg?.name ?? t('org.select')}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('org.select')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {orgs?.map((org) => (
              <DropdownMenuItem key={org.id} onSelect={() => setCurrentOrgId(org.id)}>
                {org.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Lang toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1 rounded-lg p-2 text-[--text-muted] hover:text-[--text] hover:bg-[rgba(16,185,129,0.06)] transition-colors text-xs"
          aria-label="Changer la langue"
        >
          <Globe size={16} />
          <span className="hidden sm:inline">{i18n.language.startsWith('fr') ? 'FR' : 'EN'}</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-[--text-muted] hover:text-[--text] hover:bg-[rgba(16,185,129,0.06)] transition-colors"
          aria-label="Basculer le thème"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
