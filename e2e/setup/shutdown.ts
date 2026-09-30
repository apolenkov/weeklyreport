import assert from "node:assert/strict";

const shutdown = new AbortController();
const active = new Set<Promise<unknown>>();
const SIGINT_EXIT_CODE = 130;
const SIGTERM_EXIT_CODE = 143;
let installed = false;

export function runtimeSignal(signal?: AbortSignal): AbortSignal {
  shutdown.signal.throwIfAborted();
  const combined = signal
    ? AbortSignal.any([shutdown.signal, signal])
    : shutdown.signal;
  combined.throwIfAborted();
  return combined;
}

export async function trackRuntimeOperation<T>(
  operation: Promise<T>,
): Promise<T> {
  active.add(operation);
  try {
    return await operation;
  } finally {
    active.delete(operation);
  }
}

export function installShutdown(cleanup: () => Promise<void>): () => void {
  assert(!installed, "E2E shutdown handlers are already installed");
  installed = true;
  let stopping = false;
  const onExit = (): void => shutdown.abort(new Error("E2E worker exited"));
  const onSigint = (): void => stop("SIGINT", SIGINT_EXIT_CODE);
  const onSigterm = (): void => stop("SIGTERM", SIGTERM_EXIT_CODE);

  function uninstall(): void {
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
    process.removeListener("exit", onExit);
    installed = false;
  }

  async function finish(signal: string, exitCode: number): Promise<void> {
    shutdown.abort(new Error(`E2E worker interrupted by ${signal}`));
    const results = await Promise.allSettled([...active]);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      console.error(
        `E2E shutdown: ${failures.length} owned operations stopped with errors`,
      );
    }
    try {
      await cleanup();
    } catch (error) {
      console.error("E2E owned browser cleanup failed:", error);
    } finally {
      uninstall();
      process.exit(exitCode);
    }
  }

  function stop(signal: string, exitCode: number): void {
    if (stopping) return;
    stopping = true;
    void finish(signal, exitCode).catch((error: unknown) => {
      console.error("E2E shutdown failed:", error);
      uninstall();
      process.exit(exitCode);
    });
  }

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  process.on("exit", onExit);
  return uninstall;
}
