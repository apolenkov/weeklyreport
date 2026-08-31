// Bare presence check only — stronger contracts (e.g. JWT min length) layer on.
export function requireEnv(env: Record<string, unknown>, key: string): string {
  const value = env[key];

  if (typeof value !== "string" || !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}
