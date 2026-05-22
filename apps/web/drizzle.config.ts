import { defineConfig } from 'drizzle-kit';
import { readFileSync } from 'node:fs';

// Load .env from project root if not already in env
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync('../../.env', 'utf-8');
    for (const line of env.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* .env not found, rely on process env */
  }
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
