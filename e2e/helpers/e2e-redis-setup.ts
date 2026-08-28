import { once } from "node:events";
import net from "node:net";
import readline from "node:readline";

import { assertE2eRuntimeDestructiveTarget } from "../../prisma/guards/_destructive-guard.ts";
import {
  E2E_REDIS_DATABASE,
  type E2eRedisResetEnvironment,
  type E2eRedisResetTarget,
  e2eRedisResetTarget,
  E2eRedisSetupError,
} from "./e2e-redis-target.ts";

export { e2eRedisResetTarget } from "./e2e-redis-target.ts";

const RESET_TIMEOUT_MS = 5000;

const selectCommand = Buffer.from(
  `*2\r\n$6\r\nSELECT\r\n$2\r\n${E2E_REDIS_DATABASE}\r\n`,
  "utf8",
);
const flushCommand = Buffer.from("*1\r\n$7\r\nFLUSHDB\r\n", "utf8");

export function flushE2eRedis(
  target: E2eRedisResetTarget,
  environment: E2eRedisResetEnvironment = process.env,
): Promise<void> {
  assertE2eRuntimeDestructiveTarget(
    "e2e-redis-flush",
    environment.E2E_DATABASE_URL,
    environment,
  );
  if (target.database !== E2E_REDIS_DATABASE) {
    throw new E2eRedisSetupError(
      `E2E Redis reset refuses logical database ${target.database}`,
    );
  }
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
    socket.write(selectCommand);
    const [selectResponse] = (await once(lines, "line", {
      signal,
    })) as unknown as readonly [string];
    if (selectResponse !== "+OK") {
      throw new E2eRedisSetupError(
        `E2E Redis SELECT failed: ${selectResponse}`,
      );
    }
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
  if (target) {
    assertE2eRuntimeDestructiveTarget(
      "e2e-redis-reset",
      environment.E2E_DATABASE_URL,
      environment,
    );
    await flushE2eRedis(target, environment);
  }
}
