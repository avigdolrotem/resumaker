/**
 * Standalone migration runner. Uses only runtime deps (drizzle-orm +
 * postgres) so it works inside the Next.js standalone Docker image,
 * which excludes devDeps like drizzle-kit.
 *
 * Invoked by the Helm pre-install Job:
 *   node apps/web/scripts/migrate.mjs
 *
 * Reads DATABASE_URL from env. Fails loudly if unset so the Job's
 * backoffLimit catches it instead of silently no-op'ing.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is required');
  process.exit(1);
}

// Single connection — migrate runs serially; no pool needed.
const sql = postgres(DATABASE_URL, { max: 1, ssl: 'require' });
const db = drizzle(sql);

console.log('[migrate] applying drizzle migrations…');
try {
  await migrate(db, { migrationsFolder: './apps/web/drizzle' });
  console.log('[migrate] done');
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error('[migrate] failed:', err);
  await sql.end({ timeout: 5 });
  process.exit(1);
}
