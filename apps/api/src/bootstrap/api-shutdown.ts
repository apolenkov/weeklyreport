import { setTimeout as delay } from "node:timers/promises";

import type { INestApplication } from "@nestjs/common";

import type { AppLogger } from "../lib/logger.js";
import type { ShutdownCoordinator } from "./shutdown-coordinator.js";

export interface ApiShutdownDependencies {
  readonly app: Pick<INestApplication, "close">;
  readonly logger: AppLogger;
  readonly shutdownRateLimitStore: () => Promise<void>;
  readonly shutdownOtel: () => Promise<void>;
  readonly shutdownSentry: (timeoutMs: number) => Promise<void>;
}

const CLOSE_TIMEOUT_MS = 3000;
const LOG_FLUSH_TIMEOUT_MS = 1500;
const OTEL_SHUTDOWN_TIMEOUT_MS = 2000;
const SENTRY_FLUSH_TIMEOUT_MS = 1500;

// These sequential phase limits are the complete worst-case API shutdown
// budget. docker-compose.prod.yml gives the container 20s, leaving margin for
// signal delivery and runtime teardown after this 12.5s application budget.
export const API_SHUTDOWN_BUDGET_MS =
  CLOSE_TIMEOUT_MS +
  CLOSE_TIMEOUT_MS +
  LOG_FLUSH_TIMEOUT_MS +
  LOG_FLUSH_TIMEOUT_MS +
  OTEL_SHUTDOWN_TIMEOUT_MS +
  SENTRY_FLUSH_TIMEOUT_MS;
export const API_SHUTDOWN_GRACE_PERIOD_MS = 20_000;

const withDeadline = async (
  label: string,
  timeoutMs: number,
  operation: Promise<unknown>,
): Promise<void> => {
  const cancellation = new AbortController();
  const timeout = delay(timeoutMs, undefined, {
    signal: cancellation.signal,
    ref: true,
  }).then(() => {
    throw new Error(`API shutdown ${label} exceeded its deadline`);
  });
  try {
    await Promise.race([operation, timeout]);
  } finally {
    cancellation.abort();
  }
};

const attempt = async (
  failures: readonly unknown[],
  label: string,
  timeoutMs: number,
  operation: () => Promise<unknown>,
): Promise<readonly unknown[]> => {
  try {
    await withDeadline(label, timeoutMs, operation());
    return failures;
  } catch (error: unknown) {
    return [...failures, error];
  }
};

export const shutdownApi = async (
  dependencies: ApiShutdownDependencies,
): Promise<void> => {
  const closeFailures = await attempt([], "app close", CLOSE_TIMEOUT_MS, () =>
    dependencies.app.close(),
  );
  const rateLimitFailures = await attempt(
    closeFailures,
    "rate-limit Redis shutdown",
    CLOSE_TIMEOUT_MS,
    dependencies.shutdownRateLimitStore,
  );
  const barrierFailures = await attempt(
    rateLimitFailures,
    "log barrier",
    LOG_FLUSH_TIMEOUT_MS,
    () =>
      Promise.resolve().then(() =>
        dependencies.logger.info("API shutdown log barrier reached"),
      ),
  );
  const logFailures = await attempt(
    barrierFailures,
    "file log flush",
    LOG_FLUSH_TIMEOUT_MS,
    () => dependencies.logger.flush?.() ?? Promise.resolve(),
  );
  const otelFailures = await attempt(
    logFailures,
    "OTel shutdown",
    OTEL_SHUTDOWN_TIMEOUT_MS,
    dependencies.shutdownOtel,
  );
  const failures = await attempt(
    otelFailures,
    "Sentry close",
    SENTRY_FLUSH_TIMEOUT_MS,
    () => dependencies.shutdownSentry(SENTRY_FLUSH_TIMEOUT_MS),
  );
  if (failures.length > 0)
    throw new AggregateError(failures, "API shutdown telemetry drain failed");
};

export const registerApiShutdown = (coordinator: ShutdownCoordinator): void => {
  const shutdown = (): void => coordinator.request("signal");
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};
