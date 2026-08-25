import { describe, expect, it } from "vitest";

import { withCleanSealedGrantFixture } from "../preflight-reveal-continuation-parent-test-fixture.ts";
import { runChildUntilDone } from "./preflight-reveal-host-checkpoint-parent.ts";

describe("terminal publication fail-closed boundary", () => {
  it("rejects a successful terminal child without a checkpoint client", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const runChild: typeof import("../preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () =>
          Promise.resolve({
            done: true,
            progress: fixture.validProgress,
            exitCode: 0,
            publishTerminalArtifacts: () => Promise.resolve(),
          });

      await expect(
        runChildUntilDone({
          context: fixture.context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild,
        }),
      ).rejects.toThrow(/requires a parent-only host checkpoint client/u);
    });
  });

  it("rejects a successful terminal child without a publisher", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const runChild: typeof import("../preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () =>
          Promise.resolve({
            done: true,
            progress: fixture.validProgress,
            exitCode: 0,
          });

      await expect(
        runChildUntilDone({
          context: {
            ...fixture.context,
            requestHostCheckpoint: () => Promise.resolve(undefined),
          },
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild,
        }),
      ).rejects.toThrow(/has no terminal publisher/u);
    });
  });
});
