import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#194ce6',
          50: '#EEF2FF',
          100: '#DBE4FF',
          200: '#B8C9FF',
          500: '#194ce6',
          600: '#143DBF',
          700: '#102F99',
          900: '#081A5C',
        },
        secondary: {
          50: '#EFFCF6',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
        },
        neutral: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          700: '#374151',
          900: '#111827',
        },
        'medical-teal': '#0ea5e9',
        'medical-accent': '#38bdf8',
        'background-light': '#f6f6f8',
        'background-dark': '#111521',
        success: '#10B981',
        error: '#B91C1C',
        warning: '#B45309',
        info: '#194ce6',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['var(--font-space-grotesk)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'correct-reveal': {
          '0%': { borderColor: 'transparent', opacity: '0.5' },
          '100%': { borderColor: 'var(--tw-border-opacity, 1)', opacity: '1' },
        },
        'wrong-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px)' },
          '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'correct-reveal': 'correct-reveal 300ms ease-out',
        'wrong-shake': 'wrong-shake 300ms ease-out',
      },
    },
  },
  plugins: [typography],
};
export default config;
