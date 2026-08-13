import { readFile, rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { routeForState } from "../../execution/playwright-preflight-support.ts";
import { ensurePreflightArchiveRoot } from "../../preflight-archive-path.ts";
import { preflightSessionGroupKey } from "../../runtime/preflight-session.ts";
import { preflightShardCompletionPathFor } from "../completion/preflight-shard-completion-io.ts";
import { withCompletionFixture } from "../completion/preflight-shard-completion-test-support.ts";
import {
  appendPreflightShardJournalStarted,
  preflightShardJournalPathFor,
  readPreflightShardJournal,
} from "../journal/preflight-shard-journal-io.ts";
import { withJournalContext } from "../journal/preflight-shard-journal-test-support.ts";
import { withResourceProofFixture } from "../resources/preflight-shard-resource-proof-test-support.ts";
import { runPreflightShard } from "./preflight-shard-runner.ts";
import {
  cleanupArchive,
  inputFor,
  segmentFor,
} from "./preflight-shard-runner-test-support.ts";

describe("source-bound preflight shard runner", () => {
  it("runs an empty durable journal in exact shard order and writes completion", async () => {
    await withResourceProofFixture(
      async ({ source, assignment, proof, shard }) => {
        const context = { source, assignment, resourceProof: proof, shard };
        try {
          const order: string[] = [];
          const result = await runPreflightShard(
            inputFor(context, {
              runState: ({ state }) => {
                order.push(state.stateId);
                return Promise.resolve(segmentFor(state));
              },
            }),
          );
          const expected = shard.states.map(({ state }) => state.stateId);
          expect(order).toEqual(expected);
          expect(result.skippedStateIds).toEqual([]);
          expect(result.rerunStateIds).toEqual(expected);
          expect(result.completion.assignedStateIds).toEqual(expected);
          expect(
            (
              await readPreflightShardJournal({
                context,
                archiveRoot: proof.resources.archiveRoot,
                filePath: preflightShardJournalPathFor(context),
              })
            ).map(({ status }) => status),
          ).toEqual(shard.states.flatMap(() => ["STARTED", "PASS"]));
          await expect(
            readFile(preflightShardCompletionPathFor(context), "utf8"),
          ).resolves.toContain('"artifact":"SHARD_COMPLETE"');
        } finally {
          await cleanupArchive(context);
        }
      },
    );
  });

  it("recreates the disposable boundary and skips only durable revalidated PASS states", async () => {
    await withResourceProofFixture(
      async ({ source, assignment, proof, shard }) => {
        const context = { source, assignment, resourceProof: proof, shard };
        try {
          await runPreflightShard(inputFor(context));
          await rm(preflightShardCompletionPathFor(context), { force: true });
          let recreations = 0;
          let executed = 0;
          const result = await runPreflightShard(
            inputFor(context, {
              recreateDisposableBoundary: () => {
                recreations += 1;
                return Promise.resolve();
              },
              runState: () => {
                executed += 1;
                throw new Error("skipped PASS was executed");
              },
            }),
          );
          const expected = shard.states.map(({ state }) => state.stateId);
          expect(recreations).toBe(1);
          expect(executed).toBe(0);
          expect(result.skippedStateIds).toEqual(expected);
          expect(result.rerunStateIds).toEqual([]);
        } finally {
          await cleanupArchive(context);
        }
      },
    );
  });

  it("terminalizes an interrupted STARTED record as AMBIGUOUS before retry", async () => {
    await withJournalContext(async (context, states) => {
      const [first] = states;
      const journalPath = preflightShardJournalPathFor(context);
      try {
        await ensurePreflightArchiveRoot(
          context.resourceProof.resources.archiveRoot,
        );
        await appendPreflightShardJournalStarted({
          context,
          archiveRoot: context.resourceProof.resources.archiveRoot,
          filePath: journalPath,
          state: first,
        });
        const statuses: string[] = [];
        const result = await runPreflightShard(
          inputFor(context, {
            runState: ({ state }) => {
              statuses.push(state.stateId);
              return Promise.resolve(segmentFor(state));
            },
          }),
        );
        const records = await readPreflightShardJournal({
          context,
          archiveRoot: context.resourceProof.resources.archiveRoot,
          filePath: journalPath,
        });
        expect(records.slice(0, 3).map(({ status }) => status)).toEqual([
          "STARTED",
          "AMBIGUOUS",
          "STARTED",
        ]);
        expect(statuses[0]).toBe(first.state.stateId);
        expect(result.completion.assignedStateIds).toContain(
          first.state.stateId,
        );
      } finally {
        await cleanupArchive(context);
      }
    });
  });

  it("does not reuse a skipped PASS group when resuming the first rerun state", async () => {
    await withResourceProofFixture(
      async ({ source, assignment, proof, shard }) => {
        const context = { source, assignment, resourceProof: proof, shard };
        const first = shard.states[0];
        const second = shard.states[1];
        if (first === undefined || second === undefined)
          throw new Error("fixture requires two states");
        try {
          await expect(
            runPreflightShard(
              inputFor(context, {
                runState: ({ state }) =>
                  state.stateId === second.state.stateId
                    ? Promise.reject(new Error("stop after first PASS"))
                    : Promise.resolve(segmentFor(state)),
              }),
            ),
          ).rejects.toThrow("stop after first PASS");
          await expect(
            readFile(preflightShardCompletionPathFor(context), "utf8"),
          ).rejects.toThrow(/ENOENT/u);
          const resetFlags: boolean[] = [];
          await runPreflightShard(
            inputFor(context, {
              runState: ({ state, resetRequired }) => {
                resetFlags.push(resetRequired);
                return Promise.resolve(segmentFor(state));
              },
            }),
          );
          expect(resetFlags[0]).toBe(true);
          expect(resetFlags).toHaveLength(shard.states.length - 1);
        } finally {
          await cleanupArchive(context);
        }
      },
    );
  });

  it("resets only when the executed preparation group changes", async () => {
    await withCompletionFixture(async ({ context }) => {
      const resetFlags: boolean[] = [];
      const groups = context.shard.states.map(({ state }) =>
        preflightSessionGroupKey(state, routeForState(context.source, state)),
      );
      try {
        const result = await runPreflightShard(
          inputFor(context, {
            runState: ({ state, resetRequired }) => {
              resetFlags.push(resetRequired);
              return Promise.resolve(segmentFor(state));
            },
          }),
        );
        expect(resetFlags).toEqual(
          groups.map(
            (group, index) => index === 0 || group !== groups[index - 1],
          ),
        );
        expect(result.rerunStateIds).toEqual(
          context.shard.states.map(({ state }) => state.stateId),
        );
      } finally {
        await cleanupArchive(context);
      }
    });
  });

  it("rejects live source drift and forged paths before any journal mutation", async () => {
    await withResourceProofFixture(
      async ({ source, assignment, proof, shard }) => {
        const context = { source, assignment, resourceProof: proof, shard };
        try {
          await expect(
            runPreflightShard(
              inputFor(context, {
                assertLiveSource: () =>
                  Promise.reject(new Error("clean source drift")),
              }),
            ),
          ).rejects.toThrow("clean source drift");
          await expect(
            readFile(preflightShardJournalPathFor(context), "utf8"),
          ).rejects.toThrow(/ENOENT/u);
          await expect(
            runPreflightShard({
              ...inputFor(context),
              journalPath: `${preflightShardJournalPathFor(context)}.wrong`,
            }),
          ).rejects.toThrow(/journal path/u);
          await expect(
            readFile(preflightShardCompletionPathFor(context), "utf8"),
          ).rejects.toThrow(/ENOENT/u);
        } finally {
          await cleanupArchive(context);
        }
      },
    );
  });
});
