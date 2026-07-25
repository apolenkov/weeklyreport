import type { EnvConfig } from "../infrastructure/config/env.schema";

// Multi-origin whitelist. FRONTEND_URLS (CSV) optionally extends FRONTEND_URL
// (single). CORS reflects the request origin only when it matches an entry —
// wildcard is never allowed (production env validates no '*' is present).
/**
 * Resolve Allowed Origins.
 * @param env - The env argument.
 */
export function resolveAllowedOrigins(
  env: Pick<EnvConfig, "FRONTEND_URL" | "FRONTEND_URLS">,
): readonly string[] {
  const single = env.FRONTEND_URL;
  const csv = env.FRONTEND_URLS
    ? env.FRONTEND_URLS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return Array.from(new Set([single, ...csv]));
}
