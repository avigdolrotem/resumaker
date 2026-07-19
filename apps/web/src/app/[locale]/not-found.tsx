import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';
import { GlassPanel } from '@/components/ui-effects/glass-panel';
import { Button } from '@/components/ui/button';

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
        <Button asChild size="lg" className="mt-8">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </GlassPanel>
    </main>
  );
}
