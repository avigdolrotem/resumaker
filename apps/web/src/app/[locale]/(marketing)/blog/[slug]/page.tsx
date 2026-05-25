import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import type { Locale } from '@/i18n/routing';
import { getAllPostMeta, getPostContent } from '@/lib/blog/posts';
import { Calendar, User, ArrowLeft, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPostMeta();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostContent(slug);
  if (!post) return {};
  return {
    title: post.meta.title,
    description: post.meta.summary,
    openGraph: { type: 'article', title: post.meta.title, description: post.meta.summary },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  const t = await getTranslations('blog');
  const isHebrew = locale === 'he';
  const BackIcon = isHebrew ? ArrowRight : ArrowLeft;

  const post = getPostContent(slug);
  if (!post) notFound();

  return (
    <main id="main" className="bg-background min-h-screen">
      <article className="container mx-auto max-w-3xl px-4 py-20">
        <Link
          href="/blog"
          className="text-brand-700 hover:text-brand-900 mb-8 inline-flex items-center gap-1.5 text-sm font-medium transition"
        >
          <BackIcon className="h-4 w-4" />
          {t('backToBlog')}
        </Link>

        <header className="mb-10">
          <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(post.meta.publishedAt).toLocaleDateString(
                locale === 'he' ? 'he-IL' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' },
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {post.meta.author}
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{post.meta.title}</h1>
          <p className="text-muted-foreground mt-4 text-xl">{post.meta.summary}</p>
        </header>

        <div className="prose prose-neutral max-w-none">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
