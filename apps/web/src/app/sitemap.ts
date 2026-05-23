import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

const LOCALES = ['he', 'en'] as const;
const PUBLIC_PATHS = ['', '/examples', '/privacy', '/terms', '/sign-in', '/sign-up'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return LOCALES.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${env.APP_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l === 'he' ? 'he-IL' : 'en-US', `${env.APP_URL}/${l}${path}`]),
        ),
      },
    })),
  );
}
