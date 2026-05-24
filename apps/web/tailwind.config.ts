import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#10B981', dark: '#059669' },
        bg: { DEFAULT: '#F0FAF6', dark: '#0A0F0D' },
        surface: { DEFAULT: '#FFFFFF', dark: '#111714' },
      },
      fontFamily: {
        display: ['"Syne Variable"', 'Syne', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'monospace'],
        body: ['"DM Sans Variable"', '"DM Sans"', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: 'rgba(16,185,129,0.2)',
        accent: 'rgba(16,185,129,0.2)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'pulse-bar': 'pulseBar 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseBar: {
          '0%, 100%': { transform: 'scaleX(0.6)', opacity: '0.7' },
          '50%': { transform: 'scaleX(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [animate],
};

export default config;
