import type { Config } from 'tailwindcss';

const config: Config = {
  // packages/ui was removed in the prelaunch-4 dead-code cleanup; only
  // the local src tree contributes utility classes now.
  content: ['./src/**/*.{ts,tsx,md,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Heebo for Hebrew, Inter for English
        sans: ['var(--font-heebo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heebo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand palette — bluish-violet ("indigo-ish")
        brand: {
          50: 'hsl(258, 100%, 97%)',
          100: 'hsl(258, 95%, 93%)',
          200: 'hsl(258, 90%, 85%)',
          300: 'hsl(258, 85%, 75%)',
          400: 'hsl(258, 80%, 65%)',
          500: 'hsl(258, 75%, 55%)',
          600: 'hsl(258, 70%, 45%)',
          700: 'hsl(258, 70%, 35%)',
          800: 'hsl(258, 70%, 25%)',
          900: 'hsl(258, 75%, 15%)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        // Landing-page background blobs — slow, ambient drift. Three
        // staggered offsets so the blobs don't synchronize into one
        // visible "breath".
        'blob-1': 'blob1 22s ease-in-out infinite',
        'blob-2': 'blob2 26s ease-in-out infinite',
        'blob-3': 'blob3 30s ease-in-out infinite',
        // Hero gradient text — the gradient scrolls across the letters.
        'gradient-x': 'gradientX 8s ease infinite',
        // Shimmer for skeleton loading states.
        shimmer: 'shimmer 2s linear infinite',
        // Float for hero-side mockups / accent badges.
        float: 'float 6s ease-in-out infinite',
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
        blob1: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(60px, -40px) scale(1.1)' },
          '66%': { transform: 'translate(-30px, 40px) scale(0.95)' },
        },
        blob2: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(-50px, 30px) scale(1.05)' },
          '66%': { transform: 'translate(40px, -30px) scale(0.95)' },
        },
        blob3: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(40px, 50px) scale(1.08)' },
          '66%': { transform: 'translate(-40px, -20px) scale(0.97)' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
