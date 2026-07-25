import type { EnvConfig } from "../infrastructure/config/env.schema";

// Bare presence check only — stronger contracts (e.g. JWT min length) layer on.
export function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

// Single source for "is Telegram configured" (adapter selector + integrationsStatus).
export function isTelegramConfigured(env: EnvConfig): boolean {
  return (env.TG_BOT_TOKEN?.trim() ?? "") !== "";
}
