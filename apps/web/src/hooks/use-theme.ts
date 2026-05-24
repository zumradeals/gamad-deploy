import { useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  const toggle = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('gamad-theme', next);
    setTheme(next);
  };

  return { theme, toggle };
}
