import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getPostsByLocale } from '@/lib/blog/posts';
import { ScrollReveal } from '@/components/scroll-reveal';
import { ArrowRight, ArrowLeft, Calendar, User } from 'lucide-react';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'blog' });
  return { title: t('title'), description: t('subtitle') };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations('blog');
  const isHebrew = locale === 'he';
  const ArrowIcon = isHebrew ? ArrowLeft : ArrowRight;

  // Show locale posts, fall back to English posts for untranslated content
  let posts = getPostsByLocale(locale);
  if (posts.length === 0) {
    posts = getPostsByLocale('en');
  }

  return (
    <main id="main" className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <section className="container mx-auto max-w-4xl px-4 py-20">
        <ScrollReveal>
          <div className="mb-16 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t('title')}</h1>
            <p className="text-muted-foreground mt-4 text-lg">{t('subtitle')}</p>
          </div>
        </ScrollReveal>

        <div className="grid gap-8">
          {posts.map((post, i) => (
            <ScrollReveal key={post.slug} delay={i * 0.05}>
              <article className="hover:border-brand-200 hover:shadow-brand-500/10 border-border rounded-2xl border bg-white p-8 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {new Date(post.publishedAt).toLocaleDateString(
                      locale === 'he' ? 'he-IL' : 'en-US',
                      { year: 'numeric', month: 'long', day: 'numeric' },
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {post.author}
                  </span>
                </div>

                <h2 className="text-foreground mt-4 text-2xl font-bold">{post.title}</h2>
                <p className="text-muted-foreground mt-3">{post.summary}</p>

                <Link
                  href={`/blog/${post.slug}` as '/blog/[slug]'}
                  className="text-brand-700 hover:text-brand-900 mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition"
                >
                  {t('readMore')}
                  <ArrowIcon className="h-4 w-4" />
                </Link>
              </article>
            </ScrollReveal>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="text-muted-foreground py-16 text-center">{t('noPosts')}</p>
        )}
      </section>
    </main>
  );
}
