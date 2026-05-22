import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFoundPage() {
  const t = await getTranslations('common');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-4 text-xl text-muted-foreground">Page not found</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center rounded-md bg-brand-600 px-6 text-sm font-medium text-white hover:bg-brand-700"
      >
        {t('back')}
      </Link>
    </main>
  );
}
