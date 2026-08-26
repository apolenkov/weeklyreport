import { describe, expect, it } from "vitest";

import {
  assertSpawnOwnership,
  classifyProcessGroupPermission,
  ProcessGroupCleanupError,
} from "./preflight-detached-process-group.ts";

describe("detached process-group ownership classification", () => {
  it.each([
    ["gone leader", "GONE", "UNPROVEN", "ESRCH_ALREADY_GONE"],
    ["foreign member", "LIVE", "FOREIGN", "OWNERSHIP_UNPROVEN"],
    ["unknown members", "LIVE", "UNPROVEN", "OWNERSHIP_UNPROVEN"],
    ["owned live group", "LIVE", "OWNED", "EPERM_OWNED_LIVE"],
  ] as const)(
    "classifies %s without changing the primary failure",
    (_label, leader, members, expected) => {
      expect(classifyProcessGroupPermission({ leader, members })).toBe(
        expected,
      );
    },
  );

  it("keeps cleanup classification separate from the primary error", () => {
    const primary = new Error("child timed out");
    const cleanup = new ProcessGroupCleanupError(
      "reveal-child",
      "OWNERSHIP_UNPROVEN",
      "foreign process-group member",
    );
    const aggregate = new AggregateError(
      [primary, cleanup],
      "reveal-child process-group cleanup failed",
    );
    expect(aggregate.errors).toEqual([primary, cleanup]);
    expect(cleanup.classification).toBe("OWNERSHIP_UNPROVEN");
  });

  it("fails closed when a spawned leader has no launch start token", () => {
    expect(() =>
      assertSpawnOwnership({
        operationName: "reveal-child",
        ownership: {
          pid: 1234,
          pgid: 1234,
          ...(process.getuid === undefined ? {} : { uid: process.getuid() }),
          startToken: "",
        },
      }),
    ).toThrow(
      "reveal-child process-group cleanup OWNERSHIP_UNPROVEN: spawned process has no launch start token",
    );
  });
});
