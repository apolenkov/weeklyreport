import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  unlink,
  watch,
} from "node:fs/promises";
import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import {
  canonicalHostCheckpointBytes,
  createHostCheckpointRequest,
  HOST_CHECKPOINT_MAX_BYTES,
  HOST_CHECKPOINT_TIMEOUT_MS,
  type HostCheckpointRequest,
  type HostCheckpointResponse,
  parseCanonicalHostCheckpointResponse,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const PRIVATE_FILE_MODE = 0o600;
const HOST_ROOT_MODE = 0o700;
const PERMISSION_MASK = 0o777;
const REQUEST_CANCELLED_MESSAGE = "Host checkpoint request cancelled";
const counter = { value: 0 };

type WatchDirectory = (
  directory: string,
  signal: AbortSignal,
) => AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>;
type SetTimer = (
  callback: () => void,
  milliseconds: number,
) => ReturnType<typeof setTimeout>;
type ClearTimer = (timer: ReturnType<typeof setTimeout>) => void;

const missing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const regularPrivateFile = async (filePath: string): Promise<void> => {
  const stat = await lstat(filePath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & PERMISSION_MASK) !== PRIVATE_FILE_MODE
  )
    throw new Error(
      "Host checkpoint artifact must be a mode 0600 regular file",
    );
  if (stat.size > HOST_CHECKPOINT_MAX_BYTES)
    throw new Error("Host checkpoint artifact exceeds 16 KiB");
};

const emptyPrivateRoot = async (
  archiveRoot: string,
  root: string,
): Promise<string> => {
  const archive = await ensurePreflightArchiveRoot(archiveRoot);
  const normalizedRoot = path.resolve(root);
  if (normalizedRoot !== root || !path.isAbsolute(root))
    throw new Error("Host checkpoint root must be a normalized absolute path");
  await assertPreflightArchivePath(
    archive,
    path.join(normalizedRoot, ".root-marker"),
  );
  await mkdir(normalizedRoot, { recursive: true, mode: HOST_ROOT_MODE });
  const stat = await lstat(normalizedRoot);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & PERMISSION_MASK) !== HOST_ROOT_MODE
  )
    throw new Error(
      "Host checkpoint root must be a mode 0700 regular directory",
    );
  if ((await readdir(normalizedRoot)).length > 0)
    throw new Error("Host checkpoint root must start empty");
  return normalizedRoot;
};

const writeImmutable = async (
  filePath: string,
  text: string,
): Promise<void> => {
  if (Buffer.byteLength(text, "utf8") > HOST_CHECKPOINT_MAX_BYTES)
    throw new Error("Host checkpoint artifact exceeds 16 KiB");
  counter.value += 1;
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${String(counter.value)}.tmp`,
  );
  const handle = await open(temporaryPath, "wx", PRIVATE_FILE_MODE);
  try {
    await handle.writeFile(text, "utf8");
    await handle.sync();
    try {
      await linkTemporary(temporaryPath, filePath);
    } finally {
      await unlink(temporaryPath).catch((error: unknown) => {
        if (!missing(error)) throw error;
      });
    }
  } finally {
    await handle.close();
  }
};

const linkTemporary = async (
  temporaryPath: string,
  filePath: string,
): Promise<void> => {
  try {
    await link(temporaryPath, filePath);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
    await regularPrivateFile(filePath);
    throw new Error("Host checkpoint artifact collision");
  }
};

const requestPathFor = (root: string, request: HostCheckpointRequest): string =>
  path.join(
    root,
    `HOST_CHECKPOINT_REQUEST.${request.run.attemptId}.${String(request.checkpointSequence)}.json`,
  );

const responsePathFor = (
  root: string,
  request: HostCheckpointRequest,
): string =>
  path.join(
    root,
    `HOST_CHECKPOINT_RESPONSE.${request.run.attemptId}.${String(request.checkpointSequence)}.json`,
  );

const readResponse = async (
  filePath: string,
): Promise<HostCheckpointResponse | undefined> => {
  try {
    await regularPrivateFile(filePath);
    return parseCanonicalHostCheckpointResponse(
      await readFile(filePath, "utf8"),
    );
  } catch (error: unknown) {
    if (missing(error)) return undefined;
    throw error;
  }
};

const watchForResponse = async (input: {
  readonly filePath: string;
  readonly controller: AbortController;
  readonly watchDirectory: WatchDirectory;
}): Promise<HostCheckpointResponse> => {
  if (input.controller.signal.aborted)
    throw (
      input.controller.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE)
    );
  for await (const _event of await input.watchDirectory(
    path.dirname(input.filePath),
    input.controller.signal,
  )) {
    const response = await readResponse(input.filePath);
    if (response !== undefined) {
      return response;
    }
  }
  throw new Error("Host checkpoint watcher ended without a response");
};

const waitForResponse = async (input: {
  readonly filePath: string;
  readonly signal?: AbortSignal;
  readonly watchDirectory: WatchDirectory;
  readonly setTimer: SetTimer;
  readonly clearTimer: ClearTimer;
}): Promise<HostCheckpointResponse> => {
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE);
  const first = await readResponse(input.filePath);
  if (first !== undefined) return first;
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE);
  const timeoutError = new Error("Host checkpoint timed out");
  const controller = new AbortController();
  const onAbort = (): void => controller.abort(input.signal?.reason);
  input.signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = input.setTimer(
    () => controller.abort(timeoutError),
    HOST_CHECKPOINT_TIMEOUT_MS,
  );
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
  const watcherPromise: { value?: Promise<HostCheckpointResponse> } = {};
  try {
    const watcher = await input.watchDirectory(
      path.dirname(input.filePath),
      controller.signal,
    );
    const afterWatchSetup = await readResponse(input.filePath);
    if (afterWatchSetup !== undefined) {
      controller.abort();
      return afterWatchSetup;
    }
    watcherPromise.value = watchForResponse({
      filePath: input.filePath,
      controller,
      watchDirectory: () => watcher,
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

export type RequestHostCheckpoint = (input: {
  readonly request: Omit<HostCheckpointRequest, "requestDigest">;
  readonly signal?: AbortSignal;
}) => Promise<HostCheckpointResponse | undefined>;

export const ensureHostCheckpointRoot = (input: {
  readonly archiveRoot: string;
  readonly root: string;
}): Promise<string> => emptyPrivateRoot(input.archiveRoot, input.root);

export const createFileBackedHostCheckpointClient = async (input: {
  readonly archiveRoot: string;
  readonly root: string;
  readonly watchDirectory?: WatchDirectory;
  readonly setTimer?: SetTimer;
  readonly clearTimer?: ClearTimer;
}): Promise<RequestHostCheckpoint> => {
  const root = await emptyPrivateRoot(input.archiveRoot, input.root);
  const watchDirectory =
    input.watchDirectory ??
    ((directory, signal) =>
      watch(directory, { signal }) as AsyncIterable<unknown>);
  const setTimer = input.setTimer ?? setTimeout;
  const clearTimer = input.clearTimer ?? clearTimeout;
  return async ({ request: requestBody, signal }) => {
    const request = createHostCheckpointRequest(requestBody);
    const requestPath = requestPathFor(root, request);
    const responsePath = responsePathFor(root, request);
    if ((await readResponse(responsePath)) !== undefined)
      throw new Error("Host checkpoint response already exists");
    await writeImmutable(requestPath, canonicalHostCheckpointBytes(request));
    const response = await waitForResponse({
      filePath: responsePath,
      watchDirectory,
      setTimer,
      clearTimer,
      ...(signal === undefined ? {} : { signal }),
    });
    if (response.requestDigest !== request.requestDigest)
      throw new Error("Host checkpoint response request digest mismatch");
    if (
      response.checkpointSequence !== request.checkpointSequence ||
      response.completedChildOrdinal !== request.completedChildOrdinal
    )
      throw new Error("Host checkpoint response sequence mismatch");
    if (stableSerialize(response.run) !== stableSerialize(request.run))
      throw new Error("Host checkpoint response identity mismatch");
    if (
      response.predecessorCheckpointDigest !== request.previousCheckpointDigest
    )
      throw new Error("Host checkpoint response predecessor mismatch");
    if (response.controllerObservationTimestamp < request.boundaryTimestamp)
      throw new Error("Host checkpoint response predates the request boundary");
    return response;
  };
};
