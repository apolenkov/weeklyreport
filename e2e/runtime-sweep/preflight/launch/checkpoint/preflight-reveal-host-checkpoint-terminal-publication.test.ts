import { access } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type { RevealContinuationTerminalPublicationCommit } from "../continuation/preflight-reveal-continuation-parent.ts";
import { withCleanSealedGrantFixture } from "../continuation/preflight-reveal-continuation-parent-test-fixture.ts";
import type { RequestHostCheckpoint } from "./preflight-reveal-host-checkpoint-client.ts";
import { runChildUntilDone } from "./preflight-reveal-host-checkpoint-parent.ts";
import { responseFor } from "./preflight-reveal-host-checkpoint-parent-test-fixture.ts";

describe("terminal publication fail-closed boundary", () => {
  it("rejects a successful terminal child without a checkpoint client", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () =>
          Promise.resolve({
            done: true,
            progress: fixture.validProgress,
            exitCode: 0,
            publishTerminalArtifacts: () =>
              Promise.resolve(() => Promise.resolve()),
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
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
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

  it("requires host completion before terminal publication", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      let committed = false;
      const context = {
        ...fixture.context,
        now: () => 100,
        requestHostCheckpoint: ({
          request,
        }: Parameters<RequestHostCheckpoint>[0]) =>
          Promise.resolve(responseFor(request)),
      };
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () =>
          Promise.resolve({
            done: true,
            progress: fixture.validProgress,
            exitCode: 0,
            publishTerminalArtifacts: () =>
              Promise.resolve(() => {
                committed = true;
                return Promise.resolve();
              }),
          });

      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild,
        }),
      ).rejects.toThrow(/completion client/u);
      expect(committed).toBe(false);
      await expect(access(context.canaryPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });

  it("rejects a publisher that does not return a terminal commit", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const context = {
        ...fixture.context,
        now: () => 100,
        requestHostCheckpoint: Object.assign(
          ({ request }: Parameters<RequestHostCheckpoint>[0]) =>
            Promise.resolve(responseFor(request)),
          { complete: () => Promise.resolve() },
        ),
      };
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () =>
          Promise.resolve({
            done: true,
            progress: fixture.validProgress,
            exitCode: 0,
            publishTerminalArtifacts: () =>
              Promise.resolve(
                undefined as unknown as RevealContinuationTerminalPublicationCommit,
              ),
          });

      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild,
        }),
      ).rejects.toThrow(/did not return a terminal commit/u);
    });
  });

  it("does not commit a staged canary when host completion fails", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      let committed = false;
      const commit = (): Promise<void> => {
        committed = true;
        return Promise.resolve();
      };
      const context = {
        ...fixture.context,
        now: () => 100,
        requestHostCheckpoint: Object.assign(
          ({ request }: Parameters<RequestHostCheckpoint>[0]) =>
            Promise.resolve(responseFor(request)),
          {
            complete: () =>
              Promise.reject(new Error("controller rejected completion")),
          },
        ),
      };
      const runChild: typeof import("../continuation/preflight-reveal-continuation-parent-child.ts").runContinuationChild =
        () =>
          Promise.resolve({
            done: true,
            progress: fixture.validProgress,
            exitCode: 0,
            publishTerminalArtifacts: () => Promise.resolve(commit),
          });

      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild,
        }),
      ).rejects.toThrow(/rejected completion/u);
      expect(committed).toBe(false);
      await expect(access(context.canaryPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });
});
