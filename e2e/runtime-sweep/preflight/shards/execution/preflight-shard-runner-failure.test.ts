import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { PreflightStateAmbiguousError } from "../../journal/preflight-journal-runner-support.ts";
import { preflightShardCompletionPathFor } from "../completion/preflight-shard-completion-io.ts";
import {
  preflightShardJournalPathFor,
  readPreflightShardJournal,
} from "../journal/preflight-shard-journal-io.ts";
import { runPreflightShard } from "./preflight-shard-runner.ts";
import {
  inputFor,
  segmentFor,
  statusesFor,
  withIsolatedRunnerFixture,
} from "./preflight-shard-runner-test-support.ts";

describe("source-bound preflight shard runner failure recovery", () => {
  it("redacts URL userinfo and keyed or DSN secrets in journal and thrown errors", async () => {
    await withIsolatedRunnerFixture(async ({ context }) => {
      const secrets = ["alice:pw", "url-secret", "key-secret", "dsn-secret"];
      const secretMessage =
        "request failed url=https://alice:pw@example.test?token=url-secret&apiKey=key-secret dsn=postgres://user:dsn-secret@db/report";
      let thrown: unknown;
      try {
        await runPreflightShard(
          inputFor(context, {
            runState: () => Promise.reject(new Error(secretMessage)),
          }),
        );
      } catch (error: unknown) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      const thrownMessage =
        thrown instanceof Error ? thrown.message : String(thrown);
      expect(thrownMessage).toContain("request failed");
      expect(thrownMessage).toContain("[REDACTED]");
      for (const secret of secrets) expect(thrownMessage).not.toContain(secret);

      const records = await readPreflightShardJournal({
        context,
        archiveRoot: context.resourceProof.resources.archiveRoot,
        filePath: preflightShardJournalPathFor(context),
      });
      expect(await statusesFor(context)).toEqual(["STARTED", "FAIL"]);
      expect(records.at(-1)?.failureSummary).toContain("[REDACTED]");
      for (const secret of secrets)
        expect(records.at(-1)?.failureSummary).not.toContain(secret);
      await expect(
        readFile(preflightShardCompletionPathFor(context), "utf8"),
      ).rejects.toThrow(/ENOENT/u);
    });
  });

  it("uses AMBIGUOUS for an explicitly uncertain state failure", async () => {
    await withIsolatedRunnerFixture(async ({ context }) => {
      let thrown: unknown;
      try {
        await runPreflightShard(
          inputFor(context, {
            runState: () =>
              Promise.reject(
                new PreflightStateAmbiguousError("browser state uncertain"),
              ),
          }),
        );
      } catch (error: unknown) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect(
        thrown instanceof Error ? thrown.message : String(thrown),
      ).toContain("browser state uncertain");
      expect(await statusesFor(context)).toEqual(["STARTED", "AMBIGUOUS"]);
    });
  });

  it("terminalizes source drift observed after state execution", async () => {
    await withIsolatedRunnerFixture(async ({ context }) => {
      let stateRan = false;
      await expect(
        runPreflightShard(
          inputFor(context, {
            assertLiveSource: () =>
              stateRan
                ? Promise.reject(new Error("source drift after state"))
                : Promise.resolve(),
            runState: ({ state }) => {
              stateRan = true;
              return Promise.resolve(segmentFor(state));
            },
          }),
        ),
      ).rejects.toThrow("source drift after state");
      expect(await statusesFor(context)).toEqual(["STARTED", "FAIL"]);
    });
  });

  it("keeps durable PASS after post-terminal drift and skips it on retry", async () => {
    await withIsolatedRunnerFixture(async ({ context }) => {
      const first = context.shard.states[0];
      if (first === undefined) throw new Error("fixture has no first state");
      let drift = true;
      const assertLiveSource = async (): Promise<void> => {
        const journal = await readFile(
          preflightShardJournalPathFor(context),
          "utf8",
        ).catch(() => "");
        if (drift && journal.includes('"status":"PASS"'))
          throw new Error("source drift after durable PASS");
      };
      let thrown: unknown;
      try {
        await runPreflightShard(
          inputFor(context, {
            assertLiveSource,
            runState: ({ state }) => Promise.resolve(segmentFor(state)),
          }),
        );
      } catch (error: unknown) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      const thrownMessage =
        thrown instanceof Error ? thrown.message : String(thrown);
      expect(thrownMessage).toContain("source boundary became invalid");
      expect(thrownMessage).toContain("source drift after durable PASS");
      expect(thrownMessage).not.toContain("terminal journal append failed");
      expect(await statusesFor(context)).toEqual(["STARTED", "PASS"]);
      await expect(
        readFile(preflightShardCompletionPathFor(context), "utf8"),
      ).rejects.toThrow(/ENOENT/u);

      drift = false;
      let recreations = 0;
      const rerunStateIds: string[] = [];
      const resumed = await runPreflightShard(
        inputFor(context, {
          assertLiveSource,
          recreateDisposableBoundary: () => {
            recreations += 1;
            return Promise.resolve();
          },
          runState: ({ state }) => {
            rerunStateIds.push(state.stateId);
            return Promise.resolve(segmentFor(state));
          },
        }),
      );
      expect(recreations).toBe(1);
      expect(rerunStateIds).toEqual(
        context.shard.states.slice(1).map(({ state }) => state.stateId),
      );
      expect(resumed.skippedStateIds).toEqual([first.state.stateId]);
    });
  });
});
