const SAFE_REDIRECT_SENTINEL_ORIGIN = "https://app.invalid";

/**
 * Validate a user-supplied `next` redirect target as a same-origin relative
 * path. SSR-safe: it parses against a fixed in-code sentinel origin (never
 * `window.location`, which is undefined during server render) and accepts the
 * value only when it still resolves to that sentinel — proving it is a true
 * relative path — returning `pathname + search + hash`. The browser later
 * resolves that relative path against its real origin, so no browser global is
 * read at render time. WHATWG URL normalization catches the `/\evil.com`
 * backslash bypass that a string-prefix denylist misses (the parser resolves it
 * off-origin); the leading `//` / `\` rejections are cheap defence-in-depth on
 * top, not the primary gate. Invalid input falls back to the role default.
 */
export function sanitizeNext(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (/^[\\/]{2}/.test(value) || value.startsWith("\\")) return fallback;
  try {
    const resolved = new URL(value, SAFE_REDIRECT_SENTINEL_ORIGIN);
    if (resolved.origin !== SAFE_REDIRECT_SENTINEL_ORIGIN) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
