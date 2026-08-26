import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { runRevealContinuationWithRuntime } from "./preflight-reveal-continuation-parent-runtime.ts";
import { withCleanSealedGrantFixture } from "./preflight-reveal-continuation-parent-test-fixture.ts";

const cleanupFailure = (): Promise<never> =>
  Promise.reject(new Error("lease cleanup failed"));

describe("reveal continuation runtime cleanup", () => {
  it("keeps a child failure as the root when runtime cleanup also fails", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const primary = new Error("child timed out");
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-runtime-cleanup-failure-"),
      );
      try {
        const failure = await runRevealContinuationWithRuntime({
          context: { ...fixture.context, archiveRoot },
          maxChildren: 1,
          runChildren: () => Promise.reject(primary),
          afterRun: cleanupFailure,
        }).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(AggregateError);
        const failures = (failure as AggregateError)
          .errors as readonly unknown[];
        expect(failures[0]).toBe(primary);
        expect((failures[1] as Error).message).toBe("lease cleanup failed");
        expect((failure as AggregateError).cause).toBe(failures[0]);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("surfaces runtime cleanup failure after a successful child", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-runtime-cleanup-success-"),
      );
      try {
        await expect(
          runRevealContinuationWithRuntime({
            context: { ...fixture.context, archiveRoot },
            maxChildren: 1,
            runChildren: () => Promise.resolve(0),
            afterRun: cleanupFailure,
          }),
        ).rejects.toThrow("lease cleanup failed");
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
