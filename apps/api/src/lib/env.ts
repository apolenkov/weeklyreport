import type { EnvConfig } from "../infrastructure/config/env.schema";

/**
 * refactor-auth-exemplary-layering: the single generic "require an env var to be
 * present" helper. Replaces the per-module copies that had drifted across the
 * auth module. It is intentionally a bare presence check — callers that need a
 * stronger contract (e.g. `requireJwtSecret`'s minimum-length floor) layer that
 * on top of this rather than folding it in, so this stays reusable.
 */
export function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * Whether a real Telegram bot token is configured (non-blank TG_BOT_TOKEN).
 * The single source for this check — the adapter selector and the router's
 * integrationsStatus query both call it instead of re-rolling the trim test.
 */
export function isTelegramConfigured(env: EnvConfig): boolean {
  return (env.TG_BOT_TOKEN?.trim() ?? "") !== "";
}
