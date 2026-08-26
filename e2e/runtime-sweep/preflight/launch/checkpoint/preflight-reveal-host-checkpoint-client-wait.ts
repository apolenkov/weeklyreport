import * as path from "node:path";

import {
  HOST_CHECKPOINT_TIMEOUT_MS,
  type HostCheckpointResponse,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const REQUEST_CANCELLED_MESSAGE = "Host checkpoint request cancelled";
const RESPONSE_RESCAN_INTERVAL_MS = 250;

export type WatchDirectory = (
  directory: string,
  signal: AbortSignal,
) => AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>;
export type SetTimer = (
  callback: () => void,
  milliseconds: number,
) => ReturnType<typeof setTimeout>;
export type ClearTimer = (timer: ReturnType<typeof setTimeout>) => void;

const throwIfAborted = (controller: AbortController): void => {
  if (controller.signal.aborted)
    throw controller.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE);
};

const readWatchedResponse = async (input: {
  readonly watcher: AsyncIterable<unknown>;
  readonly controller: AbortController;
  readonly filePath: string;
  readonly readResponse: (
    filePath: string,
  ) => Promise<HostCheckpointResponse | undefined>;
}): Promise<HostCheckpointResponse | undefined> => {
  throwIfAborted(input.controller);
  for await (const _event of input.watcher) {
    throwIfAborted(input.controller);
    const response = await input.readResponse(input.filePath);
    throwIfAborted(input.controller);
    if (response !== undefined) return response;
  }
  return undefined;
};

const readRescannedResponse = async (input: {
  readonly controller: AbortController;
  readonly filePath: string;
  readonly readResponse: (
    filePath: string,
  ) => Promise<HostCheckpointResponse | undefined>;
}): Promise<HostCheckpointResponse> => {
  const state: {
    timer: ReturnType<typeof setTimeout> | undefined;
    settled: boolean;
    rejectPending: ((error: unknown) => void) | undefined;
    onAbort: () => void;
  } = {
    timer: undefined,
    settled: false,
    rejectPending: undefined,
    onAbort: () => undefined,
  };

  const cleanup = (): void => {
    if (state.timer !== undefined) clearTimeout(state.timer);
    input.controller.signal.removeEventListener("abort", state.onAbort);
  };
  const reject = (error: unknown): void => {
    if (state.settled) return;
    state.settled = true;
    cleanup();
    state.rejectPending?.(error);
  };
  state.onAbort = (): void => {
    reject(
      input.controller.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE),
    );
  };
  const isPending = (): boolean =>
    !state.settled && !input.controller.signal.aborted;

  const pending = new Promise<HostCheckpointResponse>(
    (resolve, rejectPromise) => {
      state.rejectPending = rejectPromise;
      const scan = async (): Promise<void> => {
        if (!isPending()) return;
        try {
          const response = await input.readResponse(input.filePath);
          if (!isPending()) return;
          if (response !== undefined) {
            state.settled = true;
            cleanup();
            resolve(response);
            return;
          }
          state.timer = setTimeout(() => {
            state.timer = undefined;
            void scan();
          }, RESPONSE_RESCAN_INTERVAL_MS);
        } catch (error: unknown) {
          reject(error);
        }
      };
      void scan();
    },
  );
  input.controller.signal.addEventListener("abort", state.onAbort, {
    once: true,
  });
  if (input.controller.signal.aborted) state.onAbort();
  return pending;
};

const abortPromiseFor = (controller: AbortController): Promise<never> => {
  const aborted = new Promise<never>((_, reject) => {
    if (controller.signal.aborted) {
      reject(controller.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE));
      return;
    }
    controller.signal.addEventListener(
      "abort",
      () =>
        reject(
          controller.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE),
        ),
      { once: true },
    );
  });
  void aborted.catch(() => undefined);
  return aborted;
};

export const waitForHostCheckpointResponse = async (input: {
  readonly filePath: string;
  readonly signal?: AbortSignal;
  readonly watchDirectory: WatchDirectory;
  readonly setTimer: SetTimer;
  readonly clearTimer: ClearTimer;
  readonly readResponse: (
    filePath: string,
  ) => Promise<HostCheckpointResponse | undefined>;
}): Promise<HostCheckpointResponse> => {
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE);
  const timeoutError = new Error("Host checkpoint timed out");
  const controller = new AbortController();
  const onAbort = (): void => controller.abort(input.signal?.reason);
  input.signal?.addEventListener("abort", onAbort, { once: true });
  const aborted = abortPromiseFor(controller);
  const watcherPromise: { value?: Promise<HostCheckpointResponse> } = {};
  const timeout = input.setTimer(
    () => controller.abort(timeoutError),
    HOST_CHECKPOINT_TIMEOUT_MS,
  );
  try {
    const first = await Promise.race([
      input.readResponse(input.filePath),
      aborted,
    ]);
    if (first !== undefined) return first;
    if (controller.signal.aborted)
      throw controller.signal.reason ?? timeoutError;
    const watcher = await Promise.race([
      input.watchDirectory(path.dirname(input.filePath), controller.signal),
      aborted,
    ]);
    const afterWatchSetup = await Promise.race([
      input.readResponse(input.filePath),
      aborted,
    ]);
    if (afterWatchSetup !== undefined) return afterWatchSetup;
    watcherPromise.value = readWatchedResponse({
      watcher,
      controller,
      filePath: input.filePath,
      readResponse: input.readResponse,
    });
    const rescanPromise = readRescannedResponse({
      controller,
      filePath: input.filePath,
      readResponse: input.readResponse,
    });
    const watched = await Promise.race([
      watcherPromise.value,
      rescanPromise,
      aborted,
    ]);
    if (watched !== undefined) return watched;
    return await rescanPromise;
  } catch (error: unknown) {
    if (input.signal?.aborted)
      throw input.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE);
    if (controller.signal.aborted)
      throw controller.signal.reason ?? timeoutError;
    throw error;
  } finally {
    input.clearTimer(timeout);
    input.signal?.removeEventListener("abort", onAbort);
    controller.abort();
    await watcherPromise.value?.catch(() => undefined);
  }
};
