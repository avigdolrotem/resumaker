import type { Metadata } from 'next';
import { Heebo, Inter } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from 'sonner';
import { routing, getDirection, type Locale } from '@/i18n/routing';
import { CookieConsent } from '@/components/cookie-consent';
import '../globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
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
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    // Only icon.svg exists today. Add favicon.ico + apple-touch-icon.png
    // to apps/web/public/ when a real logo is designed, then add them
    // back to the icons array.
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
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
      // og-image.png intentionally omitted until a designed image lands
      // in apps/web/public/. Twitter / OG previews will fall back to the
      // page title + description — fine for soft launch.
    },
    twitter: {
      card: 'summary',
      title: t('title'),
      description: t('description'),
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
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

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

        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>

        <CookieConsent locale={locale} />

        <Toaster
          position={dir === 'rtl' ? 'top-left' : 'top-right'}
          dir={dir}
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
