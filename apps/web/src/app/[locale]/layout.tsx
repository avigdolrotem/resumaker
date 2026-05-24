import type { Metadata } from 'next';
import { Heebo, Inter } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from 'sonner';
import { routing, getDirection, type Locale } from '@/i18n/routing';
import { CookieConsent } from '@/components/cookie-consent';
import { SWRegister } from '@/components/sw-register';
import '../globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: t('title'),
      template: '%s · Resumaker',
    },
    description: t('description'),
    applicationName: 'Resumaker',
    authors: [{ name: 'Rotem Avigdol', url: 'https://avigdol.com' }],
    creator: 'Rotem Avigdol',
    publisher: 'Resumaker',
    keywords:
      locale === 'he'
        ? ['קורות חיים', 'AI', 'בינה מלאכותית', 'עבודה', 'הייטק', 'ATS', 'מותאם אישית', 'ישראל']
        : ['resume', 'CV', 'AI', 'ATS', 'job application', 'cover letter', 'Israel', 'Hebrew'],
    // Future: re-add ar/ru locales when translations are professionally
    // audited (current translations are LLM-generated stubs).
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    // Multi-format favicon set. SVG for modern browsers (Chrome, FF,
    // Safari 16+); PNGs as fallback + for the iOS home screen +
    // Android PWA install.
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/favicon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',
    alternates: {
      canonical: `/${locale}`,
      languages: {
        he: '/he',
        en: '/en',
        'x-default': '/he',
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      url: `${appUrl}/${locale}`,
      title: t('title'),
      description: t('description'),
      siteName: 'Resumaker',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'Resumaker — AI-powered resume builder',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!hasLocale(routing.locales, rawLocale)) {
    notFound();
  }
  const locale = rawLocale as Locale;

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = getDirection(locale);

  return (
    <html lang={locale} dir={dir} className={`${heebo.variable} ${inter.variable}`}>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        {/* Skip-to-main link for keyboard users (WCAG 2.4.1) */}
        <a
          href="#main"
          className="focus:bg-brand-600 sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:text-white"
        >
          {locale === 'he' ? 'דלג לתוכן הראשי' : 'Skip to main content'}
        </a>

        {/*
          IMPORTANT: ALL components that consume next-intl context (directly
          via useTranslations/useLocale, OR transitively via <Link> from
          @/i18n/navigation, which calls useLocale internally) MUST be
          children of NextIntlClientProvider.

          History of this trap:
            1. Original symptom: every page rendered as "Something went
               wrong" because CookieConsent (rendered as a sibling of
               the provider) used `<Link href="/privacy">` from
               @/i18n/navigation. The Link's hidden `useLocale()` call
               found no context and threw `new Error(undefined)` — which
               surfaces as literally "Error" with no message because
               next-intl's wrapper strips it.
            2. The provider also REQUIRES the `locale` prop in v4 — passing
               it explicitly so the SSR + hydration paths agree.

          Anything that used to be a sibling of the provider (CookieConsent,
          SWRegister, Toaster) now lives inside it. Safe even for the ones
          that don't directly use intl — costs nothing.
        */}
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}

          <CookieConsent locale={locale} />
          <SWRegister />

          <Toaster
            position={dir === 'rtl' ? 'top-left' : 'top-right'}
            dir={dir}
            richColors
            closeButton
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
