const MAX_TCP_PORT = 65_535;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export interface E2eRedisResetEnvironment {
  readonly DATABASE_URL?: string;
  readonly E2E_REDIS_FLUSH?: string;
  readonly E2E_DATABASE_URL?: string;
  readonly NODE_ENV?: string;
  readonly PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION?: string;
  readonly REDIS_HOST?: string;
  readonly REDIS_PORT?: string;
}

export interface E2eRedisResetTarget {
  readonly host: string;
  readonly port: number;
}

export class E2eRedisSetupError extends Error {
  override readonly name = "E2eRedisSetupError";
}

export function e2eRedisResetTarget(
  environment: E2eRedisResetEnvironment,
): E2eRedisResetTarget | null {
  const enabled = environment.E2E_REDIS_FLUSH;
  if (enabled !== undefined && enabled !== "false" && enabled !== "true") {
    throw new E2eRedisSetupError("E2E_REDIS_FLUSH must be true or false");
  }
  if (enabled !== "true") return null;

  const host = environment.REDIS_HOST?.trim();
  const port = Number(environment.REDIS_PORT);
  if (!host || !LOOPBACK_HOSTS.has(host)) {
    throw new E2eRedisSetupError(
      "E2E Redis reset requires an explicit loopback REDIS_HOST",
    );
  }
  if (!Number.isInteger(port) || port <= 0 || port > MAX_TCP_PORT) {
    throw new E2eRedisSetupError("E2E Redis reset requires a valid REDIS_PORT");
  }
  return { host, port };
}
