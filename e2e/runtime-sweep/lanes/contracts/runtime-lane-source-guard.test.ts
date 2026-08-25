import { describe, expect, it } from "vitest";

import {
  assertRuntimeLaneSource,
  type RuntimeLaneSourceCommand,
  startRuntimeLaneSourceMonitor,
} from "./runtime-lane-source-guard.ts";

const SOURCE_SHA = "a".repeat(40);

const commandWith =
  (status: string, head = SOURCE_SHA): RuntimeLaneSourceCommand =>
  (args) =>
    Promise.resolve(args.at(0) === "status" ? status : `${head}\n`);

describe("runtime lane source guard", () => {
  it("accepts only a clean worktree at the assigned source SHA", async () => {
    await expect(
      assertRuntimeLaneSource(
        { repoRoot: "/repo", sourceSha: SOURCE_SHA },
        commandWith(""),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects dirty tracked or untracked runtime code", async () => {
    await expect(
      assertRuntimeLaneSource(
        { repoRoot: "/repo", sourceSha: SOURCE_SHA },
        commandWith(" M e2e/runtime-sweep/replay/navigation.ts\n"),
      ),
    ).rejects.toThrow("worktree is not clean");
  });

  it("rejects a clean checkout at a different source SHA", async () => {
    await expect(
      assertRuntimeLaneSource(
        { repoRoot: "/repo", sourceSha: SOURCE_SHA },
        commandWith("", "b".repeat(40)),
      ),
    ).rejects.toThrow("does not match HEAD");
  });

  it("allows only owned Next output while monitoring an active run", async () => {
    const monitor = startRuntimeLaneSourceMonitor(
      {
        repoRoot: "/repo",
        sourceSha: SOURCE_SHA,
        onDrift: () => {
          throw new Error("unexpected source drift");
        },
      },
      commandWith("?? apps/web/.next-runtime-sweep-123/\n"),
      1000,
    );

    await expect(monitor.stop()).resolves.toBeUndefined();
  });

  it("reports tracked drift and fails the monitor", async () => {
    const drift = Promise.withResolvers<Error>();
    const monitor = startRuntimeLaneSourceMonitor(
      {
        repoRoot: "/repo",
        sourceSha: SOURCE_SHA,
        onDrift: drift.resolve,
      },
      commandWith(" M apps/web/src/app/page.tsx\n"),
      1000,
    );

    const error = await drift.promise;
    expect(error.message).toContain("drifted during execution");
    await expect(monitor.stop()).rejects.toThrow("drifted during execution");
  });
});
