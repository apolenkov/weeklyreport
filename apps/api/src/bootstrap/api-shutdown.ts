import { setTimeout as delay } from "node:timers/promises";

import type { INestApplication } from "@nestjs/common";

import type { AppLogger } from "../lib/logger.js";

export interface ApiShutdownDependencies {
  readonly app: Pick<INestApplication, "close">;
  readonly logger: AppLogger;
  readonly shutdownOtel: () => Promise<void>;
  readonly shutdownSentry: (timeoutMs: number) => Promise<void>;
  readonly writeCompletion?: () => Promise<void>;
}

const CLOSE_TIMEOUT_MS = 3000;
const LOG_FLUSH_TIMEOUT_MS = 1500;
const OTEL_SHUTDOWN_TIMEOUT_MS = 2000;
const SENTRY_FLUSH_TIMEOUT_MS = 1500;
const COMPLETION_WRITE_TIMEOUT_MS = 1500;

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

const runShutdownSequence = async (
  dependencies: ApiShutdownDependencies,
): Promise<void> => {
  const closeFailures = await attempt([], "app close", CLOSE_TIMEOUT_MS, () =>
    dependencies.app.close(),
  );
  const barrierFailures = await attempt(
    closeFailures,
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
  const completionFailures = await attempt(
    [],
    "completion artifact",
    COMPLETION_WRITE_TIMEOUT_MS,
    () => dependencies.writeCompletion?.() ?? Promise.resolve(),
  );
  if (completionFailures.length > 0)
    throw new AggregateError(
      completionFailures,
      "API shutdown completion write failed",
    );
};

export const shutdownApi = async (
  dependencies: ApiShutdownDependencies,
): Promise<void> => {
  await runShutdownSequence(dependencies);
};

export const registerApiShutdown = (
  dependencies: ApiShutdownDependencies,
  exit: (code: number) => never = (code) => process.exit(code),
): void => {
  const state: { promise: Promise<void> | null } = { promise: null };
  const shutdown = (): void => {
    state.promise ??= shutdownApi(dependencies);
    void state.promise.then(
      () => exit(0),
      (error: unknown) => {
        process.stderr.write(
          `[shutdown] ${error instanceof Error ? error.message : "unknown failure"}\n`,
        );
        exit(1);
      },
    );
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
};
