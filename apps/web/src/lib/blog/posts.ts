/**
 * Blog post loader — reads MDX files from src/content/posts at build time.
 * Uses gray-matter for frontmatter parsing.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface PostFrontmatter {
  title: string;
  slug: string;
  locale: string;
  publishedAt: string;
  summary: string;
  author: string;
}

export interface PostMeta extends PostFrontmatter {
  filename: string;
}

const POSTS_DIR = path.join(process.cwd(), 'src', 'content', 'posts');

export function getAllPostMeta(): PostMeta[] {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));
  return files
    .map((filename) => {
      const content = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8');
      const { data } = matter(content);
      return { ...(data as PostFrontmatter), filename };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPostsByLocale(locale: string): PostMeta[] {
  return getAllPostMeta().filter((p) => p.locale === locale);
}

export function getPostContent(slug: string): { meta: PostFrontmatter; content: string } | null {
  const posts = getAllPostMeta();
  const meta = posts.find((p) => p.slug === slug);
  if (!meta) return null;
  const raw = fs.readFileSync(path.join(POSTS_DIR, meta.filename), 'utf8');
  const { content } = matter(raw);
  return { meta, content };
}
