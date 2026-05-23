import type { Metadata } from 'next';
import { Heebo, Inter } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from 'sonner';
import { routing, getDirection, type Locale } from '@/i18n/routing';
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

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: {
        he: '/he',
        en: '/en',
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
