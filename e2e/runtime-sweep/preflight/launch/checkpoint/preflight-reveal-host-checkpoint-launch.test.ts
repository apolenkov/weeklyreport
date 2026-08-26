import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { withCleanSource } from "../continuation/preflight-reveal-continuation-parent-test-fixture.ts";
import { runExactAdminDemoRevealCanary } from "./preflight-reveal-host-checkpoint-launch.ts";
import {
  type RevealCanaryLifecycle,
  settleControllerAfterParentFailure,
} from "./preflight-reveal-host-checkpoint-lifecycle.ts";

const adminDemoState = (
  source: Parameters<typeof runExactAdminDemoRevealCanary>[0]["source"],
) => {
  const state = source.plan.states.find(
    (candidate) =>
      candidate.axes.role === "admin" &&
      candidate.axes.route === "admin:/admin" &&
      candidate.profile === "demo",
  );
  if (state === undefined) throw new Error("Fixture has no admin/demo state");
  return state;
};

describe("exact admin/demo reveal canary lifecycle", () => {
  it("preserves a thrown parent failure with a nonzero controller exit", async () => {
    const primary = new Error("parent failed");
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller: Promise.resolve({ code: 19 }),
      abort: () => undefined,
      close: () => undefined,
    };
    const failure = await settleControllerAfterParentFailure(
      lifecycle,
      primary,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(
      (failure as AggregateError).errors.map((error) =>
        error instanceof Error ? error.message : String(error),
      ),
    ).toEqual([
      "parent failed",
      "Host checkpoint controller exited with code 19",
    ]);
  });

  it("owns and settles the host controller when the child exits nonzero", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".reveal-owned-controller-"),
      );
      const state = adminDemoState(source);
      let controllerStarted = false;
      let controllerAborted = false;
      try {
        await expect(
          runExactAdminDemoRevealCanary({
            source,
            repoRoot,
            archiveRoot,
            canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
            selector: {
              stateId: state.stateId,
              role: "admin",
              route: "admin:/admin",
              profile: "demo",
            },
            hostCheckpointRoot: path.join(
              archiveRoot,
              "5.19-admin-demo",
              "host-checkpoints",
            ),
            hostCheckpointBaselineDigest: "d".repeat(64),
            runPlaywright: () => Promise.resolve(23),
            runHostCheckpointController: ({ signal }) => {
              controllerStarted = true;
              return new Promise<number>((resolve) => {
                signal.addEventListener(
                  "abort",
                  () => {
                    controllerAborted = true;
                    resolve(0);
                  },
                  { once: true },
                );
              });
            },
          }),
        ).resolves.toBe(23);
        expect(controllerStarted).toBe(true);
        expect(controllerAborted).toBe(true);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("propagates an early controller failure into the parent lifecycle", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".reveal-controller-failure-"),
      );
      const state = adminDemoState(source);
      let childCalls = 0;
      try {
        await expect(
          runExactAdminDemoRevealCanary({
            source,
            repoRoot,
            archiveRoot,
            canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
            selector: {
              stateId: state.stateId,
              role: "admin",
              route: "admin:/admin",
              profile: "demo",
            },
            hostCheckpointRoot: path.join(
              archiveRoot,
              "5.19-admin-demo",
              "host-checkpoints",
            ),
            hostCheckpointBaselineDigest: "d".repeat(64),
            runPlaywright: () => {
              childCalls += 1;
              return Promise.resolve(0);
            },
            runHostCheckpointController: () =>
              Promise.reject(new Error("controller failed")),
          }),
        ).rejects.toThrow("controller failed");
        expect(childCalls).toBe(0);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("preserves an independent controller failure after a nonzero child", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".reveal-nonzero-controller-failure-"),
      );
      const state = adminDemoState(source);
      try {
        const failure = await runExactAdminDemoRevealCanary({
          source,
          repoRoot,
          archiveRoot,
          canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
          selector: {
            stateId: state.stateId,
            role: "admin",
            route: "admin:/admin",
            profile: "demo",
          },
          hostCheckpointRoot: path.join(
            archiveRoot,
            "5.19-admin-demo",
            "host-checkpoints",
          ),
          hostCheckpointBaselineDigest: "d".repeat(64),
          runPlaywright: () => Promise.resolve(23),
          runHostCheckpointController: ({ signal }) =>
            new Promise<number>((_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () => reject(new Error("controller cleanup failed")),
                { once: true },
              );
            }),
        }).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(AggregateError);
        expect(
          (failure as AggregateError).errors.map((error) =>
            error instanceof Error ? error.message : String(error),
          ),
        ).toEqual([
          "Reveal continuation exited with code 23",
          "controller cleanup failed",
        ]);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
