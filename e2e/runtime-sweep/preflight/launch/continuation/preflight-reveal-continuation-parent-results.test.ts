import { describe, expect, it } from "vitest";

import {
  inventoryFor,
  runChunk,
} from "../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import { continueChild } from "./preflight-reveal-continuation-parent-results.ts";
import {
  persistChunkAssets,
  withCleanSealedGrantFixture,
} from "./preflight-reveal-continuation-parent-test-fixture.ts";

describe("continuation parent progress", () => {
  it("preserves the host-checkpoint predecessor across a real child reduction", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      let clock = 0;
      const resumed = await runChunk({
        source: fixture.source,
        state: fixture.state,
        route: fixture.route,
        root: fixture.root,
        nested: inventoryFor([]),
        stableAllPostAction: fixture.root,
        grant: fixture.sealed.grant,
        expectedGrantDigest: fixture.sealed.grant.grantDigest,
        now: () => clock++,
        deadlineAt: 10_000,
      });
      await persistChunkAssets(fixture.archiveRoot, resumed.result.chunk);

      const previousCheckpointDigest = "b".repeat(64);
      const result = await continueChild({
        context: fixture.context,
        progress: {
          ...fixture.validProgress,
          previousCheckpointDigest,
          previousSampleSequence: 61,
        },
        chunk: resumed.result.chunk,
        ordinal: 1,
      });

      expect(result.progress).toMatchObject({
        previousCheckpointDigest,
        previousSampleSequence: 61,
      });
    });
  });
});
