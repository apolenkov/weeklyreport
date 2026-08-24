import {
  link,
  lstat,
  open,
  readdir,
  readFile,
  unlink,
  watch,
} from "node:fs/promises";
import * as path from "node:path";

import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import type {
  HostCheckpointRequest,
  HostCheckpointRun,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import { HOST_CHECKPOINT_MAX_BYTES } from "./preflight-reveal-host-checkpoint-contract.ts";

export const PRIVATE_FILE_MODE = 0o600;
export const MAILBOX_MODE = 0o700;
const PERMISSION_MASK = 0o777;
const REQUEST_PREFIX = "HOST_CHECKPOINT_REQUEST.";
const RESPONSE_PREFIX = "HOST_CHECKPOINT_RESPONSE.";
const COMPLETE_PREFIX = "HOST_CHECKPOINT_COMPLETE.";
const REQUEST_SUFFIX = ".json";
// eslint-disable-next-line no-restricted-syntax -- unique temporary names are monotonic within this process
let temporaryCounter = 0;

export type WatchDirectory = (
  directory: string,
  signal: AbortSignal,
) => AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>;

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted)
    throw signal.reason ?? new Error("Host checkpoint controller aborted");
};

export const missing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export const assertPrivateFile = async (filePath: string): Promise<void> => {
  const stat = await lstat(filePath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & PERMISSION_MASK) !== PRIVATE_FILE_MODE ||
    stat.size > HOST_CHECKPOINT_MAX_BYTES
  )
    throw new Error(
      "Host checkpoint artifact must be a bounded mode 0600 file",
    );
};

export const assertMailboxRoot = async (
  archiveRoot: string,
  mailboxRoot: string,
): Promise<string> => {
  const archive = await ensurePreflightArchiveRoot(archiveRoot);
  const normalized = path.resolve(mailboxRoot);
  if (normalized !== mailboxRoot || !path.isAbsolute(mailboxRoot))
    throw new Error(
      "Host checkpoint mailbox must be a normalized absolute path",
    );
  await assertPreflightArchivePath(
    archive,
    path.join(mailboxRoot, ".root-marker"),
  );
  const stat = await lstat(mailboxRoot);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & PERMISSION_MASK) !== MAILBOX_MODE
  )
    throw new Error("Host checkpoint mailbox must be a mode 0700 directory");
  return mailboxRoot;
};

export const requestPathFor = (
  mailboxRoot: string,
  request: HostCheckpointRequest,
): string =>
  path.join(
    mailboxRoot,
    `${REQUEST_PREFIX}${request.run.attemptId}.${String(request.checkpointSequence)}${REQUEST_SUFFIX}`,
  );

export const responsePathFor = (
  mailboxRoot: string,
  request: HostCheckpointRequest,
): string =>
  path.join(
    mailboxRoot,
    `${RESPONSE_PREFIX}${request.run.attemptId}.${String(request.checkpointSequence)}${REQUEST_SUFFIX}`,
  );

export const completionPathFor = (
  mailboxRoot: string,
  run: HostCheckpointRun,
): string => path.join(mailboxRoot, `${COMPLETE_PREFIX}${run.attemptId}.json`);

export const isCompletionName = (name: string): boolean =>
  name.startsWith(COMPLETE_PREFIX) && name.endsWith(".json");

export const immutableWrite = async (
  filePath: string,
  text: string,
  options: Readonly<{ readonly signal?: AbortSignal }> = {},
): Promise<void> => {
  throwIfAborted(options.signal);
  if (Buffer.byteLength(text, "utf8") > HOST_CHECKPOINT_MAX_BYTES)
    throw new Error("Host checkpoint response exceeds 16 KiB");
  temporaryCounter += 1;
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${String(temporaryCounter)}.tmp`,
  );
  const handle = await open(temporaryPath, "wx", PRIVATE_FILE_MODE);
  try {
    await handle.writeFile(text, "utf8");
    await handle.sync();
    throwIfAborted(options.signal);
    try {
      await link(temporaryPath, filePath);
    } catch (error: unknown) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ))
        throw error;
      throw new Error("Host checkpoint response collision");
    } finally {
      await unlink(temporaryPath).catch((error: unknown) => {
        if (!missing(error)) throw error;
      });
    }
  } finally {
    await handle.close();
  }
  await assertPrivateFile(filePath);
  if ((await readFile(filePath, "utf8")) !== text)
    throw new Error("Host checkpoint response read-back drifted");
};

const requestNamesFor = async (
  mailboxRoot: string,
): Promise<readonly string[]> => {
  const entries = await readdir(mailboxRoot, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.isSymbolicLink() &&
        ((entry.name.startsWith(REQUEST_PREFIX) &&
          entry.name.endsWith(REQUEST_SUFFIX)) ||
          isCompletionName(entry.name)),
    )
    .map((entry) => entry.name)
    .toSorted((left, right) => left.localeCompare(right));
};

export const waitForRequest = async (input: {
  readonly mailboxRoot: string;
  readonly seen: ReadonlySet<string>;
  readonly signal?: AbortSignal;
  readonly watchDirectory?: WatchDirectory;
}): Promise<string> => {
  const scan = async (): Promise<string | undefined> => {
    throwIfAborted(input.signal);
    const result = (await requestNamesFor(input.mailboxRoot)).find(
      (name) => !input.seen.has(name),
    );
    throwIfAborted(input.signal);
    return result;
  };
  throwIfAborted(input.signal);
  const first = await scan();
  if (first !== undefined) return first;
  throwIfAborted(input.signal);
  const watcherController = new AbortController();
  const abort = (): void => watcherController.abort(input.signal?.reason);
  input.signal?.addEventListener("abort", abort, { once: true });
  try {
    throwIfAborted(input.signal);
    const watcher = await (input.watchDirectory?.(
      input.mailboxRoot,
      watcherController.signal,
    ) ?? watch(input.mailboxRoot, { signal: watcherController.signal }));
    throwIfAborted(input.signal);
    const afterWatch = await scan();
    if (afterWatch !== undefined) return afterWatch;
    for await (const _event of watcher) {
      throwIfAborted(input.signal);
      const next = await scan();
      if (next !== undefined) return next;
    }
    throw new Error(
      "Host checkpoint controller watcher ended without a request",
    );
  } finally {
    watcherController.abort();
    input.signal?.removeEventListener("abort", abort);
  }
};
