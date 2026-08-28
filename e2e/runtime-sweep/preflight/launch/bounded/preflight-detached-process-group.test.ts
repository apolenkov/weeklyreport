import type { ChildProcess } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

import {
  assertSpawnOwnership,
  classifyProcessGroupPermission,
  combineFailures,
  ProcessGroupCleanupError,
  waitForProcessGroupExit,
} from "./preflight-detached-process-group.ts";
import {
  processGroupStatusFor,
  signalProcessGroup,
} from "./preflight-detached-process-group-ownership.ts";

const goneChild = {
  pid: 1234,
  exitCode: 0,
  signalCode: null,
} as unknown as ChildProcess;

const goneOwnership = {
  pid: 1234,
  pgid: 1234,
  startToken: "",
} as const;

const withPermissionDeniedKill = (callback: () => void): void => {
  const kill = vi.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("permission denied"), { code: "EPERM" });
  });
  try {
    callback();
  } finally {
    kill.mockRestore();
  }
};

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

  it("does not call an EPERM liveness probe an already-gone group", () => {
    expect(
      classifyProcessGroupPermission({
        leader: "GONE",
        members: "OWNED",
        permissionDenied: true,
      }),
    ).toBe("OWNERSHIP_UNPROVEN");
  });

  it("classifies a direct EPERM status probe with a gone leader as unproven", () => {
    let failure: unknown;
    withPermissionDeniedKill(() => {
      try {
        processGroupStatusFor({
          operationName: "reveal-child",
          child: goneChild,
          ownership: goneOwnership,
        });
      } catch (error: unknown) {
        failure = error;
      }
    });
    expect(failure).toBeInstanceOf(ProcessGroupCleanupError);
    expect((failure as ProcessGroupCleanupError).classification).toBe(
      "OWNERSHIP_UNPROVEN",
    );
  });

  it("classifies a direct EPERM signal with a gone leader as unproven", () => {
    let failure: unknown;
    withPermissionDeniedKill(() => {
      try {
        signalProcessGroup({
          operationName: "reveal-child",
          child: goneChild,
          ownership: goneOwnership,
          signal: "SIGTERM",
        });
      } catch (error: unknown) {
        failure = error;
      }
    });
    expect(failure).toBeInstanceOf(ProcessGroupCleanupError);
    expect((failure as ProcessGroupCleanupError).classification).toBe(
      "OWNERSHIP_UNPROVEN",
    );
  });

  it("waits for a transient exited-leader EPERM to become ESRCH", async () => {
    const kill = vi.spyOn(process, "kill").mockImplementationOnce(() => {
      throw Object.assign(new Error("permission denied"), { code: "EPERM" });
    });
    kill.mockImplementationOnce(() => {
      throw Object.assign(new Error("gone"), { code: "ESRCH" });
    });
    try {
      await expect(
        waitForProcessGroupExit(
          {
            operationName: "reveal-child",
            child: goneChild,
            ownership: goneOwnership,
          },
          100,
        ),
      ).resolves.toBe(true);
    } finally {
      kill.mockRestore();
    }
  });

  it("keeps a persistent exited-leader EPERM fail-closed", async () => {
    const kill = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("permission denied"), { code: "EPERM" });
    });
    try {
      await expect(
        waitForProcessGroupExit(
          {
            operationName: "reveal-child",
            child: goneChild,
            ownership: goneOwnership,
          },
          25,
        ),
      ).rejects.toMatchObject({ classification: "OWNERSHIP_UNPROVEN" });
    } finally {
      kill.mockRestore();
    }
  });

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

  it("keeps a nested termination failure intact and points to its root timeout", () => {
    const timeout = new Error("child timed out");
    const terminationFailure = new AggregateError(
      [timeout, new Error("SIGINT cleanup uncertainty")],
      "process-group termination failed",
    );
    const cleanup = new ProcessGroupCleanupError(
      "reveal-child",
      "OWNERSHIP_UNPROVEN",
      "process-group liveness probe returned EPERM",
    );

    const failure = combineFailures("reveal-child", terminationFailure, [
      cleanup,
    ]);
    expect(failure).toBeInstanceOf(AggregateError);
    const failures = (failure as AggregateError).errors as readonly unknown[];
    expect(failures[0]).toBe(terminationFailure);
    expect(failures[1]).toBe(cleanup);
    expect(failure.message).toBe(
      "child timed out; reveal-child secondary cleanup failures=1",
    );
    expect((failure as AggregateError).cause).toBe(timeout);
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
