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
import { writeHostCheckpointCompletion } from "./preflight-reveal-host-checkpoint-client-completion.ts";
import {
  type ClearTimer,
  type SetTimer,
  waitForHostCheckpointResponse,
  type WatchDirectory,
} from "./preflight-reveal-host-checkpoint-client-wait.ts";
import {
  canonicalHostCheckpointBytes,
  createHostCheckpointRequest,
  HOST_CHECKPOINT_MAX_BYTES,
  type HostCheckpointCompletionBody,
  type HostCheckpointRequest,
  type HostCheckpointResponse,
  parseCanonicalHostCheckpointResponse,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const PRIVATE_FILE_MODE = 0o600;
const HOST_ROOT_MODE = 0o700;
const PERMISSION_MASK = 0o777;
const REQUEST_CANCELLED_MESSAGE = "Host checkpoint request cancelled";
const counter = { value: 0 };

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
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted)
    throw signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE);
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
    if (signal?.aborted)
      throw signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE);
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

export type RequestHostCheckpoint = ((input: {
  readonly request: Omit<HostCheckpointRequest, "requestDigest">;
  readonly signal?: AbortSignal;
}) => Promise<HostCheckpointResponse | undefined>) & {
  complete?: CompleteHostCheckpoint;
};

export type CompleteHostCheckpoint = (input: {
  readonly completion: HostCheckpointCompletionBody;
  readonly signal?: AbortSignal;
}) => Promise<void>;

export const ensureHostCheckpointRoot = (input: {
  readonly archiveRoot: string;
  readonly root: string;
}): Promise<string> => emptyPrivateRoot(input.archiveRoot, input.root);

export const createFileBackedHostCheckpointClient = async (input: {
  readonly archiveRoot: string;
  readonly root: string;
  readonly expectedBaselineReceiptDigest: string;
  readonly watchDirectory?: WatchDirectory;
  readonly setTimer?: SetTimer;
  readonly clearTimer?: ClearTimer;
  readonly now?: () => number;
}): Promise<RequestHostCheckpoint> => {
  const root = await emptyPrivateRoot(input.archiveRoot, input.root);
  const watchDirectory =
    input.watchDirectory ??
    ((directory, signal) =>
      watch(directory, { signal }) as AsyncIterable<unknown>);
  const setTimer = input.setTimer ?? setTimeout;
  const clearTimer = input.clearTimer ?? clearTimeout;
  const request = (async ({ request: requestBody, signal }) => {
    const request = createHostCheckpointRequest(requestBody);
    const requestPath = requestPathFor(root, request);
    const responsePath = responsePathFor(root, request);
    if ((await readResponse(responsePath)) !== undefined)
      throw new Error("Host checkpoint response already exists");
    await writeImmutable(
      requestPath,
      canonicalHostCheckpointBytes(request),
      signal,
    );
    const response = await waitForHostCheckpointResponse({
      filePath: responsePath,
      watchDirectory,
      setTimer,
      clearTimer,
      readResponse,
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
    if (response.baselineReceiptDigest !== input.expectedBaselineReceiptDigest)
      throw new Error("Host checkpoint response baseline receipt mismatch");
    if (response.controllerObservationTimestamp <= request.boundaryTimestamp)
      throw new Error("Host checkpoint response predates the request boundary");
    return response;
  }) as RequestHostCheckpoint;
  request.complete = async ({ completion, signal }) => {
    await writeHostCheckpointCompletion({
      archiveRoot: input.archiveRoot,
      mailboxRoot: root,
      completion,
      now: input.now ?? Date.now,
      writeImmutable,
      ...(signal === undefined ? {} : { signal }),
    });
  };
  return request;
};
