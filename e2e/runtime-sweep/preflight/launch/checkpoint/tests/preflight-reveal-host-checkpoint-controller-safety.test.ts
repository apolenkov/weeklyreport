import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  DiagnosticHostEnvelopeCounters,
  DiagnosticHostEnvelopeSnapshot,
} from "../../../diagnostics/preflight-diagnostic-host-envelope.ts";
import {
  type HostCheckpointRequest,
  parseCanonicalHostCheckpointResponse,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
} from "../preflight-reveal-host-checkpoint-contract.ts";
import { runHostCheckpointController } from "../preflight-reveal-host-checkpoint-controller.ts";
import {
  immutableWrite,
  waitForRequest,
} from "../preflight-reveal-host-checkpoint-controller-mailbox.ts";
import {
  responsePathForTest,
  waitForFile,
  withMailbox,
  writeRequest,
  writeTerminalCompletion,
} from "../preflight-reveal-host-checkpoint-controller-safety-fixture.ts";

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
  firstSnapshot: snapshotFor(91, 0, "post-infrastructure"),
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

const waitForAbort = (signal: AbortSignal): Promise<void> =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener("abort", () => resolve(), { once: true });
  });

const watchWithoutEvents = (
  signal: AbortSignal,
): AsyncGenerator<never, void, void> =>
  (async function* (): AsyncGenerator<never, void, void> {
    await waitForAbort(signal);
    yield* [];
  })();

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

  it("rejects terminal completion that skipped the final host checkpoint", async () => {
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
      await expect(controller).rejects.toThrow(/terminal child ordinal/u);
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

  it("rescans periodically when the filesystem watcher loses an event", async () => {
    await withMailbox(async (_archiveRoot, mailboxRoot) => {
      const delayedRequest = setTimeout(() => {
        void writeRequest(mailboxRoot, requestBodyFor());
      }, 10);
      try {
        const name = await waitForRequest({
          mailboxRoot,
          seen: new Set<string>(),
          watchDirectory: (_directory, signal) => watchWithoutEvents(signal),
        });
        expect(name).toMatch(/^HOST_CHECKPOINT_REQUEST\./u);
      } finally {
        clearTimeout(delayedRequest);
      }
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
        stat(responsePathForTest(mailboxRoot, request)),
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
      await waitForFile(responsePathForTest(mailboxRoot, first));
      const firstResponse = parseCanonicalHostCheckpointResponse(
        await readFile(responsePathForTest(mailboxRoot, first), "utf8"),
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
        stat(responsePathForTest(mailboxRoot, second)),
      ).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });
});
