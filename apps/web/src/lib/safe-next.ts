const SAFE_REDIRECT_SENTINEL_ORIGIN = "https://app.invalid";

// Accept only same-origin relative `next` paths (SSR-safe sentinel origin).
// WHATWG normalization catches `/\evil.com`; leading // or \ is defence-in-depth.
// Invalid input falls back to the role default.
/**
 * Sanitize Next.
 * @param value - The value argument.
 * @param fallback - The fallback argument.
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
