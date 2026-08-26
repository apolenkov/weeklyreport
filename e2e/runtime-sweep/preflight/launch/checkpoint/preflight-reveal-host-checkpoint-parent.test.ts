import { describe, expect, it } from "vitest";

import { withCleanSealedGrantFixture } from "../continuation/preflight-reveal-continuation-parent-test-fixture.ts";
import type { RequestHostCheckpoint } from "./preflight-reveal-host-checkpoint-client.ts";
import {
  type HostCheckpointCompletionBody,
  type HostCheckpointRequest,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import { runChildUntilDone } from "./preflight-reveal-host-checkpoint-parent.ts";
import { responseFor } from "./preflight-reveal-host-checkpoint-parent-test-fixture.ts";

const nonterminalChild = (
  progress: Parameters<typeof runChildUntilDone>[0]["progress"],
) => ({
  done: false as const,
  progress,
});

describe("host checkpoint parent sequencing", () => {
  it("checkpoints after every successful child including the terminal child", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const events: string[] = [];
      let childCalls = 0;
      const requests: Omit<HostCheckpointRequest, "requestDigest">[] = [];
      const context = {
        ...fixture.context,
        now: () => 100,
        requestHostCheckpoint: Object.assign(
          (input: {
            readonly request: Omit<HostCheckpointRequest, "requestDigest">;
          }) => {
            events.push("checkpoint");
            requests.push(input.request);
            return Promise.resolve(responseFor(input.request));
          },
          {
            complete: () => {
              events.push("complete");
              return Promise.resolve();
            },
          },
        ),
      };
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        (input) => {
          childCalls += 1;
          events.push(`child${childCalls - 1}`);
          return Promise.resolve(
            childCalls === 1
              ? nonterminalChild(fixture.validProgress)
              : {
                  done: true,
                  progress: input.progress,
                  exitCode: 0,
                  publishTerminalArtifacts: () => {
                    events.push("stage");
                    return Promise.resolve(() => {
                      events.push("commit");
                      return Promise.resolve();
                    });
                  },
                },
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
      expect(events).toEqual([
        "child0",
        "checkpoint",
        "child1",
        "checkpoint",
        "stage",
        "complete",
        "commit",
      ]);
      expect(requests[0]).toMatchObject({
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
      expect(requests[1]).toMatchObject({
        checkpointSequence: 2,
        completedChildOrdinal: 1,
        previousSampleSequence: 61,
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
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
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

  it("does not publish terminal artifacts when the final checkpoint fails", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      let published = false;
      const context = {
        ...fixture.context,
        now: () => 100,
        requestHostCheckpoint: () =>
          Promise.reject(new Error("controller rejected final checkpoint")),
      };
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () =>
          Promise.resolve({
            done: true,
            progress: fixture.validProgress,
            exitCode: 0,
            publishTerminalArtifacts: () => {
              published = true;
              return Promise.resolve(() => Promise.resolve());
            },
          });

      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild,
        }),
      ).rejects.toThrow(/rejected final checkpoint/u);
      expect(published).toBe(false);
    });
  });

  it.each([0, 23] as const)(
    "requires a final checkpoint only for a successful terminal child %s",
    async (exitCode) => {
      await withCleanSealedGrantFixture(async (fixture) => {
        let checkpointCalls = 0;
        const completions: HostCheckpointCompletionBody[] = [];
        const context = {
          ...fixture.context,
          now: () => 100,
          requestHostCheckpoint: Object.assign(
            ({
              request,
            }: {
              readonly request: Omit<HostCheckpointRequest, "requestDigest">;
            }) => {
              checkpointCalls += 1;
              return Promise.resolve(responseFor(request));
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
        const terminalPublisher = () =>
          Promise.resolve(() => Promise.resolve());
        const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
          () =>
            Promise.resolve({
              done: true,
              progress: fixture.validProgress,
              exitCode,
              ...(exitCode === 0
                ? { publishTerminalArtifacts: terminalPublisher }
                : {}),
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
        expect(checkpointCalls).toBe(exitCode === 0 ? 1 : 0);
        expect(completions).toHaveLength(exitCode === 0 ? 1 : 0);
        if (exitCode === 0)
          expect(completions[0]).toMatchObject({
            terminalChildOrdinal: 0,
            lastCheckpointSequence: 1,
            lastSampleSequence: 61,
          });
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
        requestHostCheckpoint: Object.assign(
          (input: {
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
          { complete: () => Promise.resolve() },
        ),
      };
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        (input) => {
          childCalls += 1;
          return Promise.resolve(
            childCalls < 3
              ? nonterminalChild(input.progress)
              : {
                  done: true,
                  progress: input.progress,
                  exitCode: 0,
                  publishTerminalArtifacts: () =>
                    Promise.resolve(() => Promise.resolve()),
                },
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
      expect(requests).toHaveLength(3);
      expect(requests[1]).toMatchObject({
        checkpointSequence: 2,
        previousSampleSequence: 61,
      });
      expect(requests[2]).toMatchObject({
        checkpointSequence: 3,
        previousSampleSequence: 62,
      });
    });
  });
});
