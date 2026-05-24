import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFoundPage() {
  const t = await getTranslations('errors');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-muted-foreground mt-4 text-xl">{t('notFound')}</p>
      <Link
        href="/"
        className="bg-brand-600 hover:bg-brand-700 mt-8 inline-flex h-10 items-center rounded-md px-6 text-sm font-medium text-white"
      >
        {t('backHome')}
      </Link>
    </main>
  );
}
