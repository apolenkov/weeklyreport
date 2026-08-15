import { describe, expect, it } from "vitest";

import { continueChild } from "../../launch/preflight-reveal-continuation-parent-results.ts";
import {
  persistChunkAssets,
  withSealedGrantFixture,
} from "../../launch/preflight-reveal-continuation-parent-test-fixture.ts";
import {
  inventoryFor,
  runChunk,
} from "./preflight-reveal-continuation-fixture.ts";

describe("R188 parent chain authority boundary", () => {
  it("rejects grant, receipt, chunk, and accepted-chunk replay drift", async () => {
    await withSealedGrantFixture(async (fixture) => {
      const grant = fixture.validProgress.grant;
      if (grant === undefined) throw new Error("Fixture has no sealed grant");
      const clock = { calls: 0 };
      const second = await runChunk({
        source: fixture.source,
        state: fixture.state,
        route: fixture.route,
        root: fixture.root,
        nested: inventoryFor([]),
        stableAllPostAction: fixture.root,
        grant: fixture.sealed.grant,
        expectedGrantDigest: fixture.sealed.grant.grantDigest,
        now: () => {
          const value = clock.calls;
          clock.calls += 1;
          return value;
        },
        deadlineAt: 1,
      });
      expect(second.result.completed).toBe(false);
      const chunk = second.result.chunk;
      await persistChunkAssets(fixture.archiveRoot, chunk);

      await expect(
        continueChild({
          context: fixture.context,
          progress: {
            ...fixture.validProgress,
            grant: { ...grant, grantDigest: "7".repeat(64) },
          },
          chunk,
          ordinal: 1,
        }),
      ).rejects.toThrow(/grant binding/u);
      await expect(
        continueChild({
          context: fixture.context,
          progress: {
            ...fixture.validProgress,
            receiptHead: "9".repeat(64),
          },
          chunk,
          ordinal: 1,
        }),
      ).rejects.toThrow(/predecessor chain/u);
      await expect(
        continueChild({
          context: fixture.context,
          progress: {
            ...fixture.validProgress,
            chunkHead: "8".repeat(64),
          },
          chunk,
          ordinal: 1,
        }),
      ).rejects.toThrow(/predecessor chain/u);

      const accepted = await continueChild({
        context: fixture.context,
        progress: fixture.validProgress,
        chunk,
        ordinal: 1,
      });
      expect(accepted.done).toBe(false);
      expect(accepted.progress.genesis).toEqual(fixture.validProgress.genesis);
      expect(accepted.progress.grant?.genesis).toEqual(
        fixture.validProgress.genesis,
      );
      await expect(
        continueChild({
          context: fixture.context,
          progress: accepted.progress,
          chunk,
          ordinal: 2,
        }),
      ).rejects.toThrow(/grant binding|predecessor chain/u);
    });
  });
});
