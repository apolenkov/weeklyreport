const SAFE_REDIRECT_SENTINEL_ORIGIN = "https://app.invalid";

// Accept only same-origin relative `next` paths (SSR-safe sentinel origin).
// WHATWG normalization catches `/\evil.com`; leading // or \ is defence-in-depth.
// Invalid input falls back to the role default.
export function sanitizeNext(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (/^[\\/]{2}/.test(value) || value.startsWith("\\")) return fallback;
  try {
    const resolved = new URL(value, SAFE_REDIRECT_SENTINEL_ORIGIN);
    if (resolved.origin !== SAFE_REDIRECT_SENTINEL_ORIGIN) return fallback;
    // Check the NORMALIZED pathname: WHATWG dot-segment resolution turns
    // '/.//evil.com' (and %-encoded/backslash variants) into '//evil.com',
    // which would leave the origin check passing while the result is a
    // protocol-relative off-origin redirect.
    if (resolved.pathname.startsWith("//")) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
