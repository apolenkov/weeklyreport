import { describe, expect, it } from "vitest";

import {
  type ControlledDiagnosticChild,
  type ControlledDiagnosticInput,
  runControlledDiagnostic,
  terminateOwnedChildGroup,
} from "../run-runtime-preflight-diagnostic-host-envelope.ts";

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  timestampWall: 1_700_000_000_000,
  phase: "post-infrastructure" as const,
  rawFreeBytes: 6 * GiB,
  availableBytes: 12 * GiB,
  totalBytes: 36 * GiB,
  compressedBytes: 4 * GiB,
  swapUsedBytes: 256 * MiB,
  swapFreeBytes: 4 * GiB,
  pressureFreePercent: 80,
  pressureState: "normal" as const,
  pageins: 100,
  pageouts: 10,
  swapins: 20,
  swapouts: 30,
  ...overrides,
});

const receiptFor = (finalReasons: string[], shouldFailFinalize = false) => ({
  record: (): Promise<void> => Promise.resolve(),
  finalize: (input: { readonly reason: string }) => {
    finalReasons.push(input.reason);
    return shouldFailFinalize
      ? Promise.reject(new Error("receipt secondary failure"))
      : Promise.resolve({ recordsPath: "records", manifestPath: "manifest" });
  },
  closeWithoutManifest: (): Promise<void> => Promise.resolve(),
});

const baseInput = (
  overrides: Partial<ControlledDiagnosticInput> = {},
): ControlledDiagnosticInput => ({
  repoRoot: "/repo",
  environment: {},
  archiveRoot: "/archive",
  outputRoot: "/archive/output",
  sourceSha: "a".repeat(40),
  sourceTree: "b".repeat(40),
  campaignId: "cr-001-test",
  collectBaseline: () =>
    Promise.resolve({
      firstSnapshot: snapshot(),
      lastSnapshot: snapshot(),
      counters: { pageins: 100, pageouts: 10, swapins: 20, swapouts: 30 },
    }),
  ...overrides,
});

describe("controlled diagnostic host envelope", () => {
  it("escalates an owned child from TERM to KILL within bounded waits", async () => {
    const signals: string[] = [];
    const neverSettles = new Promise<number>(() => undefined);
    await expect(
      terminateOwnedChildGroup({
        pid: 4321,
        completion: neverSettles,
        sendSignal: (_pid, signal) => signals.push(signal),
        wait: () => Promise.resolve(),
        termGraceMs: 0,
        killGraceMs: 0,
      }),
    ).rejects.toThrow("did not settle after SIGKILL");
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("keeps a child-first failure primary over receipt cleanup failure", async () => {
    const finalReasons: string[] = [];
    const detached = { value: false };
    const child: ControlledDiagnosticChild = {
      pid: 4321,
      completion: Promise.reject(new Error("Playwright target crashed")),
    };
    await expect(
      runControlledDiagnostic(
        baseInput({
          createReceipt: () => Promise.resolve(receiptFor(finalReasons, true)),
          spawnChild: (input) => {
            detached.value = input.detached;
            return child;
          },
          wait: () => Promise.resolve(),
          readSnapshot: () => Promise.resolve(snapshot()),
        }),
      ),
    ).rejects.toThrow("Playwright target crashed");
    expect(detached.value).toBe(true);
    expect(finalReasons).toEqual(["Playwright target crashed"]);
  });

  it("keeps a monitor breach primary and terminates only the owned child", async () => {
    const finalReasons: string[] = [];
    const terminatedPids: number[] = [];
    const child: ControlledDiagnosticChild = {
      pid: 9876,
      completion: new Promise<number>(() => undefined),
    };
    await expect(
      runControlledDiagnostic(
        baseInput({
          createReceipt: () => Promise.resolve(receiptFor(finalReasons)),
          spawnChild: () => child,
          wait: () => Promise.resolve(),
          readSnapshot: () =>
            Promise.resolve(
              snapshot({ pressureState: "warning", pressureFreePercent: 10 }),
            ),
          terminateChildGroup: (input) => {
            if (input.pid !== undefined) terminatedPids.push(input.pid);
            return Promise.resolve();
          },
        }),
      ),
    ).rejects.toThrow("Host envelope breach");
    expect(terminatedPids).toEqual([9876]);
    expect(finalReasons[0]).toContain("Host envelope breach");
  });
});
