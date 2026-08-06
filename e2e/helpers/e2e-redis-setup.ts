import { once } from "node:events";
import net from "node:net";
import readline from "node:readline";

const RESET_TIMEOUT_MS = 5000;
const MAX_TCP_PORT = 65_535;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export interface E2eRedisResetEnvironment {
  readonly E2E_REDIS_FLUSH?: string;
  readonly REDIS_HOST?: string;
  readonly REDIS_PORT?: string;
  readonly RUNTIME_SWEEP_ARCHIVE?: string;
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
  if (environment.RUNTIME_SWEEP_ARCHIVE && enabled !== "true") {
    throw new E2eRedisSetupError(
      "Runtime sweep requires E2E_REDIS_FLUSH=true for deterministic transient state",
    );
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

const flushCommand = Buffer.from("*1\r\n$7\r\nFLUSHDB\r\n", "utf8");

export function flushE2eRedis(target: E2eRedisResetTarget): Promise<void> {
  return flushE2eRedisConnection(net.createConnection(target));
}

async function flushE2eRedisConnection(socket: net.Socket): Promise<void> {
  const signal = AbortSignal.timeout(RESET_TIMEOUT_MS);
  const lines = readline.createInterface({
    input: socket,
    crlfDelay: Infinity,
  });
  try {
    await once(socket, "connect", { signal });
    socket.write(flushCommand);
    const [response] = (await once(lines, "line", {
      signal,
    })) as unknown as readonly [string];
    if (response !== "+OK") {
      throw new E2eRedisSetupError(`E2E Redis FLUSHDB failed: ${response}`);
    }
  } catch (error: unknown) {
    if (error instanceof E2eRedisSetupError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new E2eRedisSetupError(`E2E Redis FLUSHDB failed: ${reason}`);
  } finally {
    lines.close();
    socket.destroy();
  }
}

export async function resetE2eRedis(
  environment: E2eRedisResetEnvironment = process.env,
): Promise<void> {
  const target = e2eRedisResetTarget(environment);
  if (target) await flushE2eRedis(target);
}
