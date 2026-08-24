import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";

import { createParentPass } from "../../reveal/continuation/preflight-reveal-continuation-artifacts.ts";
import { writeRevealParentPass } from "../../reveal/continuation/preflight-reveal-continuation-io.ts";
import {
  canonicalHostCheckpointBytes,
  createHostCheckpointCompletion,
  createHostCheckpointRequest,
  type HostCheckpointRequest,
  type HostCheckpointRun,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import { completionPathFor } from "./preflight-reveal-host-checkpoint-controller-mailbox.ts";

const TEST_AUTHORITY_KEY_LENGTH = 64;
const MAILBOX_MODE = 0o700;
const WAIT_ATTEMPTS = 100;
const WAIT_DELAY_MS = 5;

const requestPathForTest = (
  root: string,
  request: HostCheckpointRequest,
): string =>
  path.join(
    root,
    `HOST_CHECKPOINT_REQUEST.${request.run.attemptId}.${String(request.checkpointSequence)}.json`,
  );

export const responsePathForTest = (
  root: string,
  request: HostCheckpointRequest,
): string =>
  path.join(
    root,
    `HOST_CHECKPOINT_RESPONSE.${request.run.attemptId}.${String(request.checkpointSequence)}.json`,
  );

export const writeRequest = async (
  root: string,
  body: Omit<HostCheckpointRequest, "requestDigest">,
): Promise<HostCheckpointRequest> => {
  const request = createHostCheckpointRequest(body);
  await writeFile(
    requestPathForTest(root, request),
    canonicalHostCheckpointBytes(request),
    { mode: 0o600 },
  );
  return request;
};

export const waitForFile = async (filePath: string): Promise<void> => {
  for (const attempt of Array.from(
    { length: WAIT_ATTEMPTS },
    (_, index) => index,
  )) {
    try {
      await stat(filePath);
      return;
    } catch {
      if (attempt === WAIT_ATTEMPTS - 1) break;
      await new Promise((resolve) => setTimeout(resolve, WAIT_DELAY_MS));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
};

export const withMailbox = async (
  callback: (archiveRoot: string, mailboxRoot: string) => Promise<void>,
): Promise<void> => {
  const archiveRoot = await mkdtemp(
    path.join(process.cwd(), ".host-controller-safety-"),
  );
  const mailboxRoot = path.join(archiveRoot, "mailbox");
  await mkdir(mailboxRoot, { mode: MAILBOX_MODE });
  await chmod(mailboxRoot, MAILBOX_MODE);
  try {
    await callback(archiveRoot, mailboxRoot);
  } finally {
    await rm(archiveRoot, { recursive: true, force: true });
  }
};

const parentRunFor = (run: HostCheckpointRun, digest: string) => {
  const state = {
    stateId: run.stateId,
    pairwiseDigest: digest,
    profile: "demo" as const,
    axes: {
      role: "admin" as const,
      route: "/admin",
      profileCapability: "admin-examples" as const,
      lifecycle: "open" as const,
      submission: "draft" as const,
      ownershipDensity: "none" as const,
      permission: "admin" as const,
      fault: "none" as const,
      controlTransition: "none" as const,
    },
  };
  return {
    campaignId: run.campaignId,
    sourceSha: run.sourceSha,
    sourceTree: run.sourceTree,
    treeDigest: run.treeDigest,
    sourceDigest: run.sourceDigest,
    planDigest: run.planDigest,
    state,
    stateDigest: run.stateDigest,
    selector: {
      stateId: run.stateId,
      role: "admin" as const,
      route: "/admin",
      profile: "demo" as const,
    },
    selectorDigest: digest,
    route: {
      kind: "unconditional" as const,
      role: "admin" as const,
      catalogRoute: "/admin",
      resolvedRoute: "/admin",
      landingRoute: "/admin",
      target: "none" as const,
    },
    routeDigest: run.routeDigest,
    executionScope: "canary" as const,
    attemptId: run.attemptId,
  };
};

const writeParentPass = async (input: {
  readonly archiveRoot: string;
  readonly run: HostCheckpointRun;
  readonly digest: string;
}): Promise<string> => {
  const pass = createParentPass({
    run: parentRunFor(input.run, input.digest),
    chain: {
      receiptHead: null,
      receiptCount: 0,
      chunkHead: null,
      chunkCount: 0,
    },
    reducerStateDigest: input.digest,
    controlsDigest: input.digest,
    controlsCount: 0,
    authorityKey: "e".repeat(TEST_AUTHORITY_KEY_LENGTH),
  });
  const passPath = path.join(
    input.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_PARENT_PASS.${input.run.attemptId}.0.json`,
  );
  await writeRevealParentPass({
    archiveRoot: input.archiveRoot,
    filePath: passPath,
    pass,
  });
  return passPath;
};

const completionFor = async (input: {
  readonly run: HostCheckpointRun;
  readonly passPath: string;
}) =>
  createHostCheckpointCompletion({
    artifact: "PREFLIGHT_REVEAL_HOST_CHECKPOINT_COMPLETE",
    version: 1,
    run: input.run,
    terminalChildOrdinal: 0,
    lastCheckpointSequence: 0,
    lastResponseDigest: null,
    receiptHead: null,
    receiptCount: 0,
    chunkHead: null,
    chunkCount: 0,
    completedCandidateCount: 0,
    lastSampleSequence: null,
    parentPassDigest: createHash("sha256")
      .update(await readFile(input.passPath))
      .digest("hex"),
    terminalTimestamp: 1,
  });

export const writeTerminalCompletion = async (input: {
  readonly archiveRoot: string;
  readonly mailboxRoot: string;
  readonly run: HostCheckpointRun;
  readonly digest: string;
}): Promise<void> => {
  const passPath = await writeParentPass(input);
  const completion = await completionFor({ run: input.run, passPath });
  await writeFile(
    completionPathFor(input.mailboxRoot, completion.run),
    canonicalHostCheckpointBytes(completion),
    { mode: 0o600 },
  );
};
