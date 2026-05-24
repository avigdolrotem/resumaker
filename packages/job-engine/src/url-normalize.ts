/**
 * Strips query string, fragment, and trailing slashes; lowercases the host.
 * Used for deduplication — two URLs pointing to the same page produce the same key.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}`;
    return normalized.replace(/\/+$/, '');
  } catch {
    // Not a valid URL — return lowercased original as best effort.
    return url.toLowerCase();
  }
}
