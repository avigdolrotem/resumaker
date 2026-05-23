/**
 * In-memory LRU cache for rendered PDFs.
 *
 * Keyed by (resumeId + contentHash). When the user re-downloads the same
 * resume without editing it, we serve the cached buffer instead of
 * re-rendering via React-PDF (which is CPU-heavy).
 *
 * For production scale, replace with S3 — keyed the same way, set
 * Cache-Control: private + signed-URL TTL of 1h. This module's API
 * stays stable so the swap is one file change.
 */

import { createHash } from 'crypto';

interface CacheEntry {
  buffer: Uint8Array;
  size: number;
  lastAccessed: number;
}

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB total
const MAX_ENTRIES = 200;

const cache = new Map<string, CacheEntry>();
let totalBytes = 0;

export function makeKey(resumeId: string, content: unknown): string {
  const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16);
  return `${resumeId}:${hash}`;
}

export function get(key: string): Uint8Array | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  entry.lastAccessed = Date.now();
  return entry.buffer;
}

export function set(key: string, buffer: Uint8Array): void {
  // Skip caching anything bigger than 5MB (rendered PDFs are usually ~50-200KB)
  if (buffer.byteLength > 5 * 1024 * 1024) return;

  // Evict if we'd blow either limit
  while (
    (cache.size >= MAX_ENTRIES || totalBytes + buffer.byteLength > MAX_BYTES) &&
    cache.size > 0
  ) {
    evictOldest();
  }

  cache.set(key, {
    buffer,
    size: buffer.byteLength,
    lastAccessed: Date.now(),
  });
  totalBytes += buffer.byteLength;
}

function evictOldest(): void {
  let oldestKey: string | undefined;
  let oldestTime = Infinity;
  for (const [k, v] of cache) {
    if (v.lastAccessed < oldestTime) {
      oldestKey = k;
      oldestTime = v.lastAccessed;
    }
  }
  if (oldestKey) {
    const entry = cache.get(oldestKey)!;
    totalBytes -= entry.size;
    cache.delete(oldestKey);
  }
}

export function stats(): { entries: number; bytes: number; maxBytes: number } {
  return { entries: cache.size, bytes: totalBytes, maxBytes: MAX_BYTES };
}
