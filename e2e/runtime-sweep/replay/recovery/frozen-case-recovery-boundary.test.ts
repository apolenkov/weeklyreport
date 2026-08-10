import { describe, expect, it, vi } from "vitest";

import type {
  RuntimeEventCursor,
  RuntimeEventRecords,
} from "../../matrix/runtime-matrix-evidence.ts";
import { createFrozenRecoveryBoundary } from "./frozen-case-recovery-boundary.ts";

const cursor = (responses: number): RuntimeEventCursor => ({
  consoleMessages: 0,
  pageErrors: 0,
  requestFailures: 0,
  responses,
});

const records = (correlationId: string): RuntimeEventRecords => ({
  consoleMessages: [],
  pageErrors: [],
  requestFailures: [],
  responses: [
    {
      requestId: `recovery-${correlationId}`,
      url: "/trpc/report.get",
      method: "GET",
      resourceType: "fetch",
      status: 200,
      ok: true,
      startedAt: "2026-08-08T00:00:00.000Z",
      endedAt: "2026-08-08T00:00:00.010Z",
      durationMs: 10,
      correlationId,
    },
  ],
});

describe("frozen recovery evidence boundary", () => {
  it("keeps action-attempt and recovery event ledgers separate", async () => {
    const events: string[] = [];
    const action = { records: records("action"), cursor: cursor(1) };
    const recovery = { records: records("recovery"), cursor: cursor(2) };
    const consumeSince = vi
      .fn()
      .mockReturnValueOnce(action)
      .mockReturnValueOnce(recovery);
    const recorder = createFrozenRecoveryBoundary(
      {
        waitForIdle: vi.fn(() => Promise.resolve()),
        consumeSince,
      } as never,
      cursor(0),
      "2026-08-08T00:00:00.000Z",
      async (_window, outcome) => {
        events.push(`capture-${outcome.status}`);
        await Promise.resolve();
        events.push("capture-complete");
      },
    );

    await recorder.boundary.beforeRecovery({ status: "pass" });
    events.push("reset-start");
    await recorder.boundary.afterRecovery({ status: "pass" });
    recorder.finalize();
    const result = await recorder.result;

    expect(result?.action.records).toEqual(records("action"));
    expect(result?.recovery.records).toEqual(records("recovery"));
    expect(result?.outcome).toEqual({ status: "pass" });
    expect(consumeSince.mock.calls).toEqual([[cursor(0)], [cursor(1)]]);
    expect(events).toEqual(["capture-pass", "capture-complete", "reset-start"]);
  });

  it("resolves without evidence when no recovery starts", async () => {
    const recorder = createFrozenRecoveryBoundary({} as never, cursor(0), "x");
    recorder.finalize();
    await expect(recorder.result).resolves.toBeUndefined();
  });
});
