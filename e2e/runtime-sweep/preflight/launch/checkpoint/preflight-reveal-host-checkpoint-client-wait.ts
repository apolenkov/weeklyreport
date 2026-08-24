import * as path from "node:path";

import {
  HOST_CHECKPOINT_TIMEOUT_MS,
  type HostCheckpointResponse,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const REQUEST_CANCELLED_MESSAGE = "Host checkpoint request cancelled";

export type WatchDirectory = (
  directory: string,
  signal: AbortSignal,
) => AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>;
export type SetTimer = (
  callback: () => void,
  milliseconds: number,
) => ReturnType<typeof setTimeout>;
export type ClearTimer = (timer: ReturnType<typeof setTimeout>) => void;

const readWatchedResponse = async (input: {
  readonly watcher: AsyncIterable<unknown>;
  readonly controller: AbortController;
  readonly filePath: string;
  readonly readResponse: (
    filePath: string,
  ) => Promise<HostCheckpointResponse | undefined>;
}): Promise<HostCheckpointResponse> => {
  if (input.controller.signal.aborted)
    throw (
      input.controller.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE)
    );
  for await (const _event of input.watcher) {
    const response = await input.readResponse(input.filePath);
    if (response !== undefined) return response;
  }
  throw new Error("Host checkpoint watcher ended without a response");
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
    return await Promise.race([watcherPromise.value, aborted]);
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
