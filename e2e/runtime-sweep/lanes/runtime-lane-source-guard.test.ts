import { describe, expect, it } from "vitest";

import {
  assertRuntimeLaneSource,
  type RuntimeLaneSourceCommand,
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
});
