const FATAL_SHUTDOWN_DEADLINE_MS = 5000;

export interface ShutdownCoordinator {
  readonly request: (cause: "signal" | "fatal") => void;
}

interface ShutdownCoordinatorOptions {
  readonly exit?: (code: number) => void;
  readonly fatalDeadlineMs?: number;
}

export function createShutdownCoordinator(
  drain: () => Promise<void>,
  options: ShutdownCoordinatorOptions = {},
): ShutdownCoordinator {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const deadlineMs = options.fatalDeadlineMs ?? FATAL_SHUTDOWN_DEADLINE_MS;
  const state: {
    drain: Promise<void> | null;
    fatal: boolean;
    finished: boolean;
    fatalTimeout: ReturnType<typeof setTimeout> | undefined;
  } = { drain: null, fatal: false, finished: false, fatalTimeout: undefined };

  const finish = (code: number): void => {
    if (state.finished) return;
    state.finished = true;
    clearTimeout(state.fatalTimeout);
    exit(code);
  };

  return {
    request(cause) {
      if (state.finished) return;
      if (cause === "fatal" && !state.fatal) {
        state.fatal = true;
        state.fatalTimeout = setTimeout(() => {
          process.stderr.write("[fatal] shutdown timed out\n");
          finish(1);
        }, deadlineMs);
      }
      if (state.drain) return;
      state.drain = Promise.resolve().then(drain);
      void state.drain.then(
        () => finish(state.fatal ? 1 : 0),
        (error: unknown) => {
          if (state.finished) return;
          process.stderr.write(
            `[${state.fatal ? "fatal" : "shutdown"}] shutdown failed: ${error instanceof Error ? error.message : "unknown failure"}\n`,
          );
          finish(1);
        },
      );
    },
  };
}
