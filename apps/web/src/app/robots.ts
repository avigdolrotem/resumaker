import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/he',
          '/en',
          '/he/examples',
          '/en/examples',
          '/he/privacy',
          '/en/privacy',
          '/he/terms',
          '/en/terms',
        ],
        disallow: [
          '/api/',
          '/he/dashboard',
          '/he/builder',
          '/he/settings',
          '/he/admin',
          '/en/dashboard',
          '/en/builder',
          '/en/settings',
          '/en/admin',
        ],
      },
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'CCBot'],
        disallow: '/',
      },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
