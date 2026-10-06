import {
  canonicalHttpOrigin,
  type EnvConfig,
} from "../infrastructure/config/env.schema";

// Multi-origin allowlist. FRONTEND_URL(S) hold application URLs whose paths
// may serve redirects, but CORS authorization compares only each canonical
// HTTP(S) origin against the browser's Origin header — entries are
// normalized and deduped here so "https://App.example.test/" allows
// "https://app.example.test". Env validation rejects entries that cannot
// form an origin; a residue invalid entry fails boot rather than silently
// narrowing the allowlist.
export function resolveAllowedOrigins(
  env: Pick<EnvConfig, "FRONTEND_URL" | "FRONTEND_URLS">,
): readonly string[] {
  const entries = [
    env.FRONTEND_URL,
    ...(env.FRONTEND_URLS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  ];
  const origins = entries.map((entry) => {
    const origin = canonicalHttpOrigin(entry);
    if (origin === null) {
      throw new Error("configured frontend URL cannot form an HTTP(S) origin");
    }
    return origin;
  });
  return Array.from(new Set(origins));
}
