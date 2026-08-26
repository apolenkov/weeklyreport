import { readFile } from "node:fs/promises";
import * as path from "node:path";

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
  it("does not expose a raw PID termination path", async () => {
    const terminationSource = await readFile(
      path.resolve(
        import.meta.dirname,
        "..",
        "preflight-diagnostic-child-termination.ts",
      ),
      "utf8",
    );
    expect(terminationSource).not.toContain("process.kill");
    expect(terminationSource).not.toMatch(/\bpid\b/u);
  });

  it("escalates an owned child from TERM to KILL within bounded waits", async () => {
    const signals: string[] = [];
    const neverSettles = new Promise<number>(() => undefined);
    await expect(
      terminateOwnedChildGroup({
        completion: neverSettles,
        signal: (signal) => signals.push(signal),
        wait: () => Promise.resolve(),
        termGraceMs: 0,
        killGraceMs: 0,
      }),
    ).rejects.toThrow("did not settle after SIGKILL");
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("refuses termination without a birth-bound handle", async () => {
    await expect(
      terminateOwnedChildGroup({ completion: Promise.resolve(0) }),
    ).rejects.toThrow(/owned handle/u);
  });

  it("keeps a child-first failure primary over receipt cleanup failure", async () => {
    const finalReasons: string[] = [];
    const child: ControlledDiagnosticChild = {
      completion: Promise.reject(new Error("Playwright target crashed")),
      signal: () => undefined,
      close: () => Promise.resolve(),
      abort: (primary) => Promise.reject(primary),
    };
    await expect(
      runControlledDiagnostic(
        baseInput({
          createReceipt: () => Promise.resolve(receiptFor(finalReasons, true)),
          spawnChild: () => child,
          wait: () => Promise.resolve(),
          readSnapshot: () => Promise.resolve(snapshot()),
        }),
      ),
    ).rejects.toThrow("Playwright target crashed");
    expect(finalReasons).toEqual(["Playwright target crashed"]);
  });

  it("keeps a monitor breach primary and terminates only the owned child", async () => {
    const finalReasons: string[] = [];
    const signals: NodeJS.Signals[] = [];
    const closed = { value: false };
    const child: ControlledDiagnosticChild = {
      completion: new Promise<number>(() => undefined),
      signal: (signal) => signals.push(signal),
      close: () => {
        closed.value = true;
        return Promise.resolve();
      },
      abort: (primary) => {
        closed.value = true;
        return Promise.reject(primary);
      },
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
            expect(input.signal).toBe(child.signal);
            input.signal?.("SIGTERM");
            return Promise.resolve();
          },
        }),
      ),
    ).rejects.toThrow("Host envelope breach");
    expect(signals).toEqual(["SIGTERM"]);
    expect(closed.value).toBe(true);
    expect(finalReasons[0]).toContain("Host envelope breach");
  });

  it("reports the child primary together with ownership cleanup failure", async () => {
    const finalReasons: string[] = [];
    const child: ControlledDiagnosticChild = {
      completion: Promise.reject(new Error("Playwright target crashed")),
      signal: () => undefined,
      close: () => Promise.resolve(),
      abort: (primary) =>
        Promise.reject(
          new AggregateError(
            [primary, new Error("ownership gone assertion failed")],
            "diagnostic primary and cleanup failed",
          ),
        ),
    };
    const failure = await runControlledDiagnostic(
      baseInput({
        createReceipt: () => Promise.resolve(receiptFor(finalReasons)),
        spawnChild: () => child,
        wait: () => Promise.resolve(),
        readSnapshot: () => Promise.resolve(snapshot()),
      }),
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      expect.objectContaining({ message: "Playwright target crashed" }),
      expect.objectContaining({ message: "ownership gone assertion failed" }),
    ]);
    expect(finalReasons).toEqual(["Playwright target crashed"]);
  });
});
