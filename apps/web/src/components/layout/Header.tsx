import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Globe, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';

export function Header() {
  const { t, i18n } = useTranslation('common');
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleLang = () => {
    const next = i18n.language.startsWith('fr') ? 'en' : 'fr';
    void i18n.changeLanguage(next);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[--border] bg-[--surface]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-[--text]">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[--accent] text-white text-sm font-bold">G</span>
          <span>GAMAD<span className="text-[--accent]"> Deploy</span></span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/#features" className="text-sm text-[--text-muted] hover:text-[--accent] transition-colors">{t('nav.features')}</Link>
          <Link to="/#pricing" className="text-sm text-[--text-muted] hover:text-[--accent] transition-colors">{t('nav.pricing')}</Link>
          <Link to="/#docs" className="text-sm text-[--text-muted] hover:text-[--accent] transition-colors">{t('nav.docs')}</Link>
        </nav>

        {/* Actions desktop */}
        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={toggleLang}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[--text-muted] hover:text-[--accent] transition-colors"
            title={i18n.language.startsWith('fr') ? t('lang.en') : t('lang.fr')}
          >
            <Globe size={16} />
          </button>
          <button
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[--text-muted] hover:text-[--accent] transition-colors"
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/auth/login">
            <Button variant="ghost" size="sm">{t('nav.login')}</Button>
          </Link>
          <Link to="/auth/register">
            <Button size="sm">{t('nav.start')}</Button>
          </Link>
        </div>

        {/* Burger mobile */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-md text-[--text-muted] hover:text-[--accent] md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="border-t border-[--border] bg-[--surface] px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            <Link to="/#features" className="text-sm text-[--text-muted]" onClick={() => setMenuOpen(false)}>{t('nav.features')}</Link>
            <Link to="/#pricing" className="text-sm text-[--text-muted]" onClick={() => setMenuOpen(false)}>{t('nav.pricing')}</Link>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={toggleLang} className="flex items-center gap-1 text-xs text-[--text-muted]">
                <Globe size={14} />{i18n.language.startsWith('fr') ? 'EN' : 'FR'}
              </button>
              <button onClick={toggle} className="flex items-center gap-1 text-xs text-[--text-muted]">
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
            <Link to="/auth/login" onClick={() => setMenuOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">{t('nav.login')}</Button>
            </Link>
            <Link to="/auth/register" onClick={() => setMenuOpen(false)}>
              <Button size="sm" className="w-full">{t('nav.start')}</Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
