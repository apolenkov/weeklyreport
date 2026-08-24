import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import * as path from "node:path";

import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import {
  canonicalHostCheckpointBytes,
  createHostCheckpointCompletion,
  HOST_CHECKPOINT_MAX_BYTES,
  type HostCheckpointCompletionBody,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import { completionPathFor } from "./preflight-reveal-host-checkpoint-controller-mailbox.ts";

const PRIVATE_FILE_MODE = 0o600;
const PERMISSION_MASK = 0o777;
const REQUEST_CANCELLED_MESSAGE = "Host checkpoint request cancelled";

const regularPrivateFile = async (filePath: string): Promise<void> => {
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

export const writeHostCheckpointCompletion = async (input: {
  readonly archiveRoot: string;
  readonly mailboxRoot: string;
  readonly completion: HostCheckpointCompletionBody;
  readonly signal?: AbortSignal;
  readonly now: () => number;
  readonly writeImmutable: (
    filePath: string,
    text: string,
    signal?: AbortSignal,
  ) => Promise<void>;
}): Promise<void> => {
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(REQUEST_CANCELLED_MESSAGE);
  const passPath = path.join(
    input.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_PARENT_PASS.${input.completion.run.attemptId}.${String(input.completion.terminalChildOrdinal)}.json`,
  );
  await assertPreflightArchivePath(
    await ensurePreflightArchiveRoot(input.archiveRoot),
    passPath,
  );
  await regularPrivateFile(passPath);
  const parentPassDigest = createHash("sha256")
    .update(await readFile(passPath))
    .digest("hex");
  const complete = createHostCheckpointCompletion({
    ...input.completion,
    parentPassDigest,
    terminalTimestamp: input.now(),
  });
  await input.writeImmutable(
    completionPathFor(input.mailboxRoot, complete.run),
    canonicalHostCheckpointBytes(complete),
    input.signal,
  );
};
