import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Github, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation('common');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[--border] bg-[--surface]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-[--text]">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[--accent] text-white text-sm font-bold">G</span>
              <span>GAMAD<span className="text-[--accent]"> Deploy</span></span>
            </Link>
            <p className="mt-3 text-sm text-[--text-muted] max-w-xs">{t('footer.tagline')}</p>
            <div className="mt-4 flex gap-3">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="flex h-8 w-8 items-center justify-center rounded-md border border-[--border] text-[--text-muted] hover:text-[--accent] hover:border-[--accent] transition-colors">
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-[--text] mb-3">{t('footer.product')}</h4>
            <ul className="space-y-2">
              {(['features','pricing','docs','changelog'] as const).map((key) => (
                <li key={key}>
                  <Link to="#" className="text-sm text-[--text-muted] hover:text-[--accent] transition-colors">
                    {t(`footer.${key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-[--text] mb-3">{t('footer.company')}</h4>
            <ul className="space-y-2">
              {(['about','blog','careers','contact'] as const).map((key) => (
                <li key={key}>
                  <Link to="#" className="text-sm text-[--text-muted] hover:text-[--accent] transition-colors">
                    {t(`footer.${key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-[--text] mb-3">{t('footer.legal')}</h4>
            <ul className="space-y-2">
              {(['privacy','terms','security'] as const).map((key) => (
                <li key={key}>
                  <Link to="#" className="text-sm text-[--text-muted] hover:text-[--accent] transition-colors">
                    {t(`footer.${key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[--border] pt-6">
          <p className="text-xs text-[--text-muted]">{t('footer.copyright', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
