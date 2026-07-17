import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';
import { GlassPanel } from '@/components/ui-effects/glass-panel';

export default async function NotFoundPage() {
  const t = await getTranslations('errors');

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-8">
      <AnimatedMeshBg intensity="normal" />
      <GlassPanel
        intensity="default"
        animateIn
        className="relative flex flex-col items-center px-10 py-14 text-center sm:px-16"
      >
        <h1 className="from-brand-500 to-accent-500 bg-gradient-to-br bg-clip-text text-7xl font-bold text-transparent sm:text-8xl">
          404
        </h1>
        <p className="text-muted-foreground mt-4 text-xl">{t('notFound')}</p>
        <Link
          href="/"
          className="from-brand-500 to-accent-500 shadow-brand-500/30 ease-snappy mt-8 inline-flex h-11 items-center rounded-full bg-gradient-to-br px-8 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.96]"
        >
          {t('backHome')}
        </Link>
      </GlassPanel>
    </main>
  );
}
