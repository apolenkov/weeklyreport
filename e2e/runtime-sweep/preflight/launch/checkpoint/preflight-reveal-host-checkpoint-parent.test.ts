import { describe, expect, it } from "vitest";

import { HOST_ENVELOPE_THRESHOLDS } from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import { withCleanSealedGrantFixture } from "../preflight-reveal-continuation-parent-test-fixture.ts";
import type { RequestHostCheckpoint } from "./preflight-reveal-host-checkpoint-client.ts";
import {
  createHostCheckpointRequest,
  createHostCheckpointResponse,
  type HostCheckpointCompletionBody,
  type HostCheckpointRequest,
  type HostCheckpointResponse,
  hostCheckpointThresholdDigest,
  hostRecordDigestFor,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import { runChildUntilDone } from "./preflight-reveal-host-checkpoint-parent.ts";

const HOST_BASELINE_RECORD_COUNT =
  HOST_ENVELOPE_THRESHOLDS.postInfrastructureBaselineSamples;

const responseFor = (
  body: Omit<HostCheckpointRequest, "requestDigest">,
  overrides: Readonly<{
    readonly checkpointSequence?: number;
    readonly controllerObservationTimestamp?: number;
    readonly sampleTimestamp?: number;
  }> = {},
): HostCheckpointResponse => {
  const request = createHostCheckpointRequest(body);
  const sample = {
    eventSequence:
      (request.previousSampleSequence ?? HOST_BASELINE_RECORD_COUNT) + 1,
    timestampWall: overrides.sampleTimestamp ?? 200,
    phase: "runtime" as const,
    status: "healthy" as const,
    reasons: [],
    breachStreaks: {
      rawFreeBytes: 0,
      availableBytes: 0,
      pressureFreePercent: 0,
      compressedBytes: 0,
    },
    pressureState: "normal" as const,
    metrics: {
      rawFreeBytes: 10 * 1024 ** 3,
      availableBytes: 9 * 1024 ** 3,
      totalBytes: 16 * 1024 ** 3,
      swapFreeBytes: 4 * 1024 ** 3,
      pressureFreePercent: 80,
      swapUsedBytes: 0,
      compressedBytes: 1024,
      cumulativeCounters: {
        pageins: sampleSequenceFor(request),
        pageouts: 50,
        swapins: 2,
        swapouts: 1,
      },
    },
    nextCounters: {
      pageins: sampleSequenceFor(request),
      pageouts: 50,
      swapins: 2,
      swapouts: 1,
    },
  };
  return createHostCheckpointResponse({
    artifact: "PREFLIGHT_REVEAL_HOST_CHECKPOINT",
    version: 1,
    status: "HEALTHY",
    run: request.run,
    checkpointSequence:
      overrides.checkpointSequence ?? request.checkpointSequence,
    completedChildOrdinal: request.completedChildOrdinal,
    requestDigest: request.requestDigest,
    predecessorCheckpointDigest: request.previousCheckpointDigest,
    controllerObservationTimestamp:
      overrides.controllerObservationTimestamp ?? 201,
    baselineReceiptDigest: "d".repeat(64),
    sample,
    coverage: {
      priorSequence: request.previousSampleSequence ?? 0,
      firstSequence: (request.previousSampleSequence ?? 0) + 1,
      lastSequence: sample.eventSequence,
      coveredCount:
        sample.eventSequence - (request.previousSampleSequence ?? 0),
    },
    thresholdDigest: hostCheckpointThresholdDigest(),
    hostRecordDigest: hostRecordDigestFor(sample),
  });
};

const sampleSequenceFor = (request: HostCheckpointRequest): number =>
  (request.previousSampleSequence ?? HOST_BASELINE_RECORD_COUNT) + 1;

const nonterminalChild = (
  progress: Parameters<typeof runChildUntilDone>[0]["progress"],
) => ({
  done: false as const,
  progress,
});

describe("host checkpoint parent sequencing", () => {
  it("orders child0, accepted reduction, checkpoint, then child1", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const events: string[] = [];
      let childCalls = 0;
      let requestBody: Omit<HostCheckpointRequest, "requestDigest"> | undefined;
      const context = {
        ...fixture.context,
        now: () => 100,
        requestHostCheckpoint: (input: {
          readonly request: Omit<HostCheckpointRequest, "requestDigest">;
        }) => {
          events.push("checkpoint");
          requestBody = input.request;
          return Promise.resolve(responseFor(input.request));
        },
      };
      const runChild: typeof import("../preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () => {
          childCalls += 1;
          events.push(`child${childCalls - 1}`);
          return Promise.resolve(
            childCalls === 1
              ? nonterminalChild(fixture.validProgress)
              : { done: true, progress: fixture.validProgress, exitCode: 0 },
          );
        };
      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 2,
          runChild,
        }),
      ).resolves.toBe(0);
      expect(events).toEqual(["child0", "checkpoint", "child1"]);
      expect(requestBody).toMatchObject({
        checkpointSequence: 1,
        completedChildOrdinal: 0,
        receiptHead: fixture.validProgress.receiptHead,
        receiptCount: fixture.validProgress.receiptCount,
        chunkHead: fixture.validProgress.chunkHead,
        chunkCount: fixture.validProgress.chunkCount,
        completedCandidateCount:
          fixture.validProgress.previousCompletedCandidateCount,
        previousCheckpointDigest: null,
        previousSampleSequence: null,
      });
    });
  });

  const blockedScenario = async (
    checkpoint: RequestHostCheckpoint,
  ): Promise<void> => {
    await withCleanSealedGrantFixture(async (fixture) => {
      let childCalls = 0;
      const context = {
        ...fixture.context,
        now: () => 100,
        requestHostCheckpoint: checkpoint,
      };
      const runChild: typeof import("../preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () => {
          childCalls += 1;
          return Promise.resolve(nonterminalChild(fixture.validProgress));
        };
      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 2,
          runChild,
        }),
      ).rejects.toThrow();
      expect(childCalls).toBe(1);
    });
  };

  it("blocks child1 on a rejected response", () =>
    blockedScenario(() =>
      Promise.reject(new Error("controller rejected checkpoint")),
    ));
  it("blocks child1 on a missing response", () =>
    blockedScenario(() => Promise.resolve(undefined)));
  it("blocks child1 on a stale response", () =>
    blockedScenario(({ request }) =>
      Promise.resolve(responseFor(request, { sampleTimestamp: 99 })),
    ));
  it("blocks child1 on a gapped response", () =>
    blockedScenario(({ request }) =>
      Promise.resolve(
        responseFor(request, {
          checkpointSequence: request.checkpointSequence + 1,
        }),
      ),
    ));

  it.each([0, 23] as const)(
    "does not request a checkpoint after terminal/failed child %s",
    async (exitCode) => {
      await withCleanSealedGrantFixture(async (fixture) => {
        let checkpointCalls = 0;
        const completions: HostCheckpointCompletionBody[] = [];
        const context = {
          ...fixture.context,
          requestHostCheckpoint: Object.assign(
            () => {
              checkpointCalls += 1;
              return Promise.reject(
                new Error("checkpoint must not be requested"),
              );
            },
            {
              complete: ({
                completion,
              }: {
                readonly completion: HostCheckpointCompletionBody;
              }) => {
                completions.push(completion);
                return Promise.resolve();
              },
            },
          ),
        };
        const runChild: typeof import("../preflight-reveal-continuation-parent-child.ts").runContinuationChild =
          () =>
            Promise.resolve({
              done: true,
              progress: fixture.validProgress,
              exitCode,
            });
        await expect(
          runChildUntilDone({
            context,
            progress: fixture.validProgress,
            ordinal: 0,
            maxChildren: 1,
            runChild,
          }),
        ).resolves.toBe(exitCode);
        expect(checkpointCalls).toBe(0);
        expect(completions).toHaveLength(exitCode === 0 ? 1 : 0);
      });
    },
  );

  it("carries the checkpoint predecessor into the next request", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const requests: Omit<HostCheckpointRequest, "requestDigest">[] = [];
      let childCalls = 0;
      let responseSequence = 0;
      const context = {
        ...fixture.context,
        now: () => 100,
        requestHostCheckpoint: (input: {
          readonly request: Omit<HostCheckpointRequest, "requestDigest">;
        }) => {
          requests.push(input.request);
          responseSequence += 1;
          return Promise.resolve(
            responseFor(input.request, {
              sampleTimestamp: 200 + responseSequence,
            }),
          );
        },
      };
      const runChild: typeof import("../preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        (input) => {
          childCalls += 1;
          return Promise.resolve(
            childCalls < 3
              ? nonterminalChild(input.progress)
              : { done: true, progress: input.progress, exitCode: 0 },
          );
        };
      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 3,
          runChild,
        }),
      ).resolves.toBe(0);
      expect(requests).toHaveLength(2);
      expect(requests[0]).toMatchObject({
        checkpointSequence: 1,
        previousCheckpointDigest: null,
        previousSampleSequence: null,
      });
      expect(requests[1]).toMatchObject({
        checkpointSequence: 2,
        previousSampleSequence: 61,
      });
      expect(requests[1]?.previousCheckpointDigest).toMatch(/^[0-9a-f]{64}$/u);
    });
  });
});
