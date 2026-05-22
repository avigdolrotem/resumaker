import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx,md,mdx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Heebo for Hebrew, Inter for English
        sans: ['var(--font-heebo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heebo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand palette — will be refined with UI/UX Pro Max
        brand: {
          50: 'hsl(220, 100%, 97%)',
          100: 'hsl(220, 95%, 93%)',
          200: 'hsl(220, 90%, 85%)',
          300: 'hsl(220, 85%, 75%)',
          400: 'hsl(220, 80%, 65%)',
          500: 'hsl(220, 75%, 55%)',
          600: 'hsl(220, 70%, 45%)',
          700: 'hsl(220, 70%, 35%)',
          800: 'hsl(220, 70%, 25%)',
          900: 'hsl(220, 75%, 15%)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // RTL plugin enables logical properties (ps-4 instead of pl-4)
  ],
};

export default config;
