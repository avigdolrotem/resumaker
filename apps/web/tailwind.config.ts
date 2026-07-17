import type { Config } from 'tailwindcss';

// NOT loaded by the build — Tailwind v4 only reads a JS config via an
// explicit `@config` directive, and src/app/globals.css has none. This
// file is kept solely as the `shadcn` CLI's config pointer
// (components.json → tailwind.config). All real tokens, keyframes, and
// plugins (`tailwindcss-animate`, `@tailwindcss/typography`) live in
// globals.css `@theme`/`@plugin` — treat that file as the source of
// truth and keep this one a best-effort mirror.
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
        // Brand palette — bluish-violet ("indigo-ish"). Mirrors the
        // --color-brand-* ramp in globals.css (hue 252).
        brand: {
          50: 'hsl(252, 100%, 97%)',
          100: 'hsl(252, 95%, 93%)',
          200: 'hsl(252, 90%, 85%)',
          300: 'hsl(252, 85%, 75%)',
          400: 'hsl(252, 80%, 65%)',
          500: 'hsl(252, 75%, 55%)',
          600: 'hsl(252, 70%, 47%)',
          700: 'hsl(252, 72%, 38%)',
          800: 'hsl(252, 75%, 28%)',
          900: 'hsl(252, 80%, 18%)',
          950: 'hsl(252, 85%, 9%)',
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
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};

export default config;
