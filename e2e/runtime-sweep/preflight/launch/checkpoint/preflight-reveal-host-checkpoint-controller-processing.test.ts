import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
} from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import type { HealthyPostInfrastructureReceipt } from "../../diagnostics/receipt/preflight-diagnostic-host-envelope-post-infrastructure-reader.ts";
import {
  type HostCheckpointRequest,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import {
  type ControllerState,
  processHostCheckpointRequest,
  readAndEvaluateRuntimeSample,
} from "./preflight-reveal-host-checkpoint-controller-processing.ts";
import {
  withMailbox,
  writeRequest,
} from "./preflight-reveal-host-checkpoint-controller-safety-fixture.ts";
import { request } from "./preflight-reveal-host-checkpoint-test-fixture.ts";

const snapshotFor = (
  phase: DiagnosticHostEnvelopeSnapshot["phase"],
  swapUsedBytes: number,
): DiagnosticHostEnvelopeSnapshot => ({
  timestampWall: phase === "runtime" ? 200 : 50,
  phase,
  rawFreeBytes: 6 * 1024 ** 3,
  availableBytes: 12 * 1024 ** 3,
  totalBytes: 36 * 1024 ** 3,
  compressedBytes: 4 * 1024 ** 3,
  swapUsedBytes,
  swapFreeBytes: 4 * 1024 ** 3,
  pressureFreePercent: 80,
  pressureState: "normal",
  pageins: 100,
  pageouts: 10,
  swapins: 20,
  swapouts: 30,
});

const digest = "c".repeat(64);
const emptyBootstrapRun = {
  campaignId: "controller-empty-bootstrap",
  sourceSha: "a".repeat(40),
  sourceTree: "b".repeat(40),
  treeDigest: digest,
  sourceDigest: digest,
  planDigest: digest,
  attemptId: "attempt-empty-bootstrap",
  stateId: "state-admin-demo",
  stateDigest: digest,
  profile: "demo",
  role: "admin",
  route: "admin:/admin",
  routeDigest: digest,
} as const;

const emptyBootstrapRequestBody = (): Omit<
  HostCheckpointRequest,
  "requestDigest"
> => ({
  artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
  run: emptyBootstrapRun,
  checkpointSequence: 1,
  completedChildOrdinal: 0,
  boundaryTimestamp: 100,
  receiptHead: null,
  receiptCount: 0,
  chunkHead: null,
  chunkCount: 0,
  completedCandidateCount: 0,
  previousCheckpointDigest: null,
  previousSampleSequence: null,
});

const initialControllerStateFor = (
  baseline: HealthyPostInfrastructureReceipt,
): ControllerState => ({
  attemptId: undefined,
  responseCount: 0,
  lastResponseDigest: null,
  expectedSequence: 1,
  previousCheckpointDigest: null,
  previousReceiptHead: null,
  previousReceiptCount: 0,
  previousChunkHead: null,
  previousChunkCount: 0,
  previousCompletedCandidateCount: 0,
  previousSampleSequence: null,
  previousCounters: baseline.lastCounters,
  breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
});

describe("host checkpoint baseline anchor", () => {
  it("accepts the exact initial empty-bootstrap checkpoint", async () => {
    await withMailbox(async (archiveRoot, mailboxRoot) => {
      const baseline: HealthyPostInfrastructureReceipt = {
        manifestPath: "/archive/manifest.json",
        recordsPath: "/archive/records.jsonl",
        recordCount: 60,
        payloadBytes: 1,
        baselineReceiptDigest: "d".repeat(64),
        firstSnapshot: snapshotFor("post-infrastructure", 0),
        lastSnapshot: snapshotFor("post-infrastructure", 0),
        lastCounters: { pageins: 100, pageouts: 10, swapins: 20, swapouts: 30 },
      };
      const checkpointRequest = await writeRequest(
        mailboxRoot,
        emptyBootstrapRequestBody(),
      );
      const state = initialControllerStateFor(baseline);

      await expect(
        processHostCheckpointRequest({
          request: checkpointRequest,
          requestPath: path.join(
            mailboxRoot,
            `HOST_CHECKPOINT_REQUEST.${checkpointRequest.run.attemptId}.1.json`,
          ),
          state,
          controller: { ...emptyBootstrapRun, archiveRoot, mailboxRoot },
          baseline,
          readSnapshot: () => Promise.resolve(snapshotFor("runtime", 0)),
        }),
      ).resolves.toMatchObject({ checkpointSequence: 1 });
      expect(state).toMatchObject({
        responseCount: 1,
        previousReceiptCount: 0,
        previousChunkCount: 0,
        previousCompletedCandidateCount: 0,
      });
    });
  });

  it("measures runtime swap growth from the first baseline sample", async () => {
    const firstSnapshot = snapshotFor("post-infrastructure", 2 * 1024 ** 3);
    const lastSnapshot = snapshotFor(
      "post-infrastructure",
      2 * 1024 ** 3 + 400 * 1024 ** 2,
    );
    const baseline: HealthyPostInfrastructureReceipt = {
      manifestPath: "/archive/manifest.json",
      recordsPath: "/archive/records.jsonl",
      recordCount: 60,
      payloadBytes: 1,
      baselineReceiptDigest: "d".repeat(64),
      firstSnapshot,
      lastSnapshot,
      lastCounters: { pageins: 100, pageouts: 10, swapins: 20, swapouts: 30 },
    };
    const state = {
      attemptId: undefined,
      responseCount: 0,
      lastResponseDigest: null,
      expectedSequence: 1,
      previousCheckpointDigest: null,
      previousReceiptHead: null,
      previousReceiptCount: 0,
      previousChunkHead: null,
      previousChunkCount: 0,
      previousCompletedCandidateCount: 0,
      previousSampleSequence: null,
      previousCounters: baseline.lastCounters,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
    } satisfies ControllerState;

    await expect(
      readAndEvaluateRuntimeSample({
        request,
        state,
        baseline,
        readSnapshot: () =>
          Promise.resolve(
            snapshotFor("runtime", 2 * 1024 ** 3 + 600 * 1024 ** 2),
          ),
      }),
    ).rejects.toThrow(/swap growth/u);

    await expect(
      readAndEvaluateRuntimeSample({
        request,
        state,
        baseline,
        snapshotTimeoutMs: 20,
        readSnapshot: () =>
          new Promise<DiagnosticHostEnvelopeSnapshot>(() => undefined),
      }),
    ).rejects.toThrow("Host checkpoint snapshot timed out after 20ms");
  });
});
