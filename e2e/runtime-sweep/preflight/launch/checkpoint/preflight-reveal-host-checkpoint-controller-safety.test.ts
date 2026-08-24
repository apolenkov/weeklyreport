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

import { describe, expect, it } from "vitest";

import type {
  DiagnosticHostEnvelopeCounters,
  DiagnosticHostEnvelopeSnapshot,
} from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import {
  canonicalHostCheckpointBytes,
  createHostCheckpointRequest,
  type HostCheckpointRequest,
  parseCanonicalHostCheckpointResponse,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import { runHostCheckpointController } from "./preflight-reveal-host-checkpoint-controller.ts";
import { immutableWrite } from "./preflight-reveal-host-checkpoint-controller-mailbox.ts";
import { writeTerminalCompletion } from "./preflight-reveal-host-checkpoint-controller-safety-fixture.ts";

const sourceSha = "a".repeat(40);
const sourceTree = "b".repeat(40);
const digest = "c".repeat(64);
const baselineReceiptDigest = "d".repeat(64);
const run = {
  campaignId: "controller-safety-campaign",
  sourceSha,
  sourceTree,
  treeDigest: digest,
  sourceDigest: digest,
  planDigest: digest,
  attemptId: "attempt-controller-safety",
  stateId: "state-admin-demo",
  stateDigest: digest,
  profile: "demo",
  role: "admin",
  route: "admin:/admin",
  routeDigest: digest,
} as const;
const controllerIdentity = {
  sourceSha,
  sourceTree,
  campaignId: run.campaignId,
  treeDigest: run.treeDigest,
  sourceDigest: run.sourceDigest,
  planDigest: run.planDigest,
  stateId: run.stateId,
  stateDigest: run.stateDigest,
  profile: run.profile,
  role: run.role,
  route: run.route,
  routeDigest: run.routeDigest,
} as const;

const snapshotFor = (
  timestampWall: number,
  counterOffset: number,
  phase: DiagnosticHostEnvelopeSnapshot["phase"] = "runtime",
): DiagnosticHostEnvelopeSnapshot => ({
  timestampWall,
  phase,
  rawFreeBytes: 0,
  availableBytes: 12 * 1024 ** 3,
  totalBytes: 36 * 1024 ** 3,
  compressedBytes: 4 * 1024 ** 3,
  swapUsedBytes: 256 * 1024 ** 2,
  swapFreeBytes: 4 * 1024 ** 3,
  pressureFreePercent: 80,
  pressureState: "normal",
  pageins: 100 + counterOffset,
  pageouts: 10 + counterOffset,
  swapins: 20 + counterOffset,
  swapouts: 30 + counterOffset,
});

const baseline = {
  manifestPath: "/archive/baseline/host-pressure-manifest.json",
  recordsPath: "/archive/baseline/host-pressure.jsonl",
  recordCount: 60 as const,
  payloadBytes: 1,
  baselineReceiptDigest,
  lastSnapshot: snapshotFor(150, 0, "post-infrastructure"),
  lastCounters: {
    pageins: 100,
    pageouts: 10,
    swapins: 20,
    swapouts: 30,
  } satisfies DiagnosticHostEnvelopeCounters,
};

const requestBodyFor = (
  overrides: Partial<HostCheckpointRequest> = {},
): Omit<HostCheckpointRequest, "requestDigest"> => ({
  artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
  run,
  checkpointSequence: 1,
  completedChildOrdinal: 0,
  boundaryTimestamp: 100,
  receiptHead: digest,
  receiptCount: 1,
  chunkHead: digest,
  chunkCount: 1,
  completedCandidateCount: 1,
  previousCheckpointDigest: null,
  previousSampleSequence: null,
  ...overrides,
});

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
const writeRequest = async (
  root: string,
  body: Omit<HostCheckpointRequest, "requestDigest">,
): Promise<HostCheckpointRequest> => {
  const request = createHostCheckpointRequest(body);
  await writeFile(
    requestPathFor(root, request),
    canonicalHostCheckpointBytes(request),
    { mode: 0o600 },
  );
  return request;
};
const waitForFile = async (filePath: string): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await stat(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
};
const withMailbox = async (
  callback: (archiveRoot: string, mailboxRoot: string) => Promise<void>,
): Promise<void> => {
  const archiveRoot = await mkdtemp(
    path.join(process.cwd(), ".host-controller-safety-"),
  );
  const mailboxRoot = path.join(archiveRoot, "mailbox");
  await mkdir(mailboxRoot, { mode: 0o700 });
  await chmod(mailboxRoot, 0o700);
  try {
    await callback(archiveRoot, mailboxRoot);
  } finally {
    await rm(archiveRoot, { recursive: true, force: true });
  }
};

describe("host checkpoint controller safety boundaries", () => {
  it("checks cancellation at the immutable publication boundary", async () => {
    await withMailbox(async (_archiveRoot, mailboxRoot) => {
      let reads = 0;
      const signal = {
        get aborted(): boolean {
          reads += 1;
          return reads > 1;
        },
        reason: new Error("commit deadline"),
      } as unknown as AbortSignal;
      const filePath = path.join(
        mailboxRoot,
        "HOST_CHECKPOINT_RESPONSE.commit.json",
      );
      await expect(
        immutableWrite(filePath, "{}\n", { signal }),
      ).rejects.toThrow("commit deadline");
      await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  it("accepts only a source-bound terminal completion after the parent PASS", async () => {
    await withMailbox(async (archiveRoot, mailboxRoot) => {
      const controller = runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        ...controllerIdentity,
        baseline,
        maxCheckpoints: 1,
        watchDirectory: async () => {
          await writeTerminalCompletion({
            archiveRoot,
            mailboxRoot,
            run,
            digest,
          });
          return (async function* (): AsyncGenerator<never, void, void> {
            await Promise.resolve();
            yield* [];
          })();
        },
      });
      await expect(controller).resolves.toEqual({
        responseCount: 0,
        lastResponseDigest: null,
      });
    });
  });

  it("rescans after watcher setup and does not lose a request", async () => {
    await withMailbox(async (archiveRoot, mailboxRoot) => {
      let setupCalls = 0;
      const controller = runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        ...controllerIdentity,
        baseline,
        maxCheckpoints: 1,
        watchDirectory: async () => {
          setupCalls += 1;
          await writeRequest(
            mailboxRoot,
            requestBodyFor(
              setupCalls === 1
                ? {}
                : {
                    checkpointSequence: 2,
                    completedChildOrdinal: 1,
                    boundaryTimestamp: 300,
                    receiptHead: "e".repeat(64),
                    receiptCount: 2,
                    chunkHead: "f".repeat(64),
                    chunkCount: 2,
                    completedCandidateCount: 2,
                    previousCheckpointDigest: digest,
                    previousSampleSequence: 61,
                  },
            ),
          );
          return (async function* (): AsyncGenerator<never, void, void> {
            await Promise.resolve();
            yield* [];
          })();
        },
        readSnapshot: () => Promise.resolve(snapshotFor(200, 1)),
      });
      const exhausted = expect(controller).rejects.toThrow(
        /exhausted.*terminal completion/u,
      );
      await exhausted;
      expect(setupCalls).toBe(2);
    });
  });

  it("does not publish after an abort during sampling", async () => {
    await withMailbox(async (archiveRoot, mailboxRoot) => {
      const abortController = new AbortController();
      const controller = runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        ...controllerIdentity,
        baseline,
        signal: abortController.signal,
        maxCheckpoints: 1,
        readSnapshot: () => {
          abortController.abort(new Error("deadline"));
          return Promise.resolve(snapshotFor(200, 1));
        },
      });
      const request = await writeRequest(mailboxRoot, requestBodyFor());
      await expect(controller).rejects.toThrow("deadline");
      await expect(
        stat(responsePathFor(mailboxRoot, request)),
      ).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });

  it("rejects a checkpoint without monotone candidate progress", async () => {
    await withMailbox(async (archiveRoot, mailboxRoot) => {
      const controller = runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        ...controllerIdentity,
        baseline,
        maxCheckpoints: 2,
        readSnapshot: () => Promise.resolve(snapshotFor(200, 1)),
      });
      const first = await writeRequest(mailboxRoot, requestBodyFor());
      await waitForFile(responsePathFor(mailboxRoot, first));
      const firstResponse = parseCanonicalHostCheckpointResponse(
        await readFile(responsePathFor(mailboxRoot, first), "utf8"),
      );
      const second = await writeRequest(
        mailboxRoot,
        requestBodyFor({
          checkpointSequence: 2,
          completedChildOrdinal: 1,
          boundaryTimestamp: 300,
          receiptHead: "e".repeat(64),
          receiptCount: 2,
          chunkHead: "f".repeat(64),
          chunkCount: 2,
          completedCandidateCount: 1,
          previousCheckpointDigest: firstResponse.responseDigest,
          previousSampleSequence: 61,
        }),
      );
      await expect(controller).rejects.toThrow(/progress did not advance/u);
      await expect(
        stat(responsePathFor(mailboxRoot, second)),
      ).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });
});
