import type { Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialNavigation } from "../replay/frozen-case-live-capture.ts";

const harness = vi.hoisted(() => ({
  events: [] as string[],
  runtimeEvents: {
    consoleMessages: [] as Readonly<{ type: string; text: string }>[],
    pageErrors: [] as Readonly<{ message: string }>[],
    requestFailures: [] as Readonly<{
      url: string;
      failure: string | null;
    }>[],
  },
  resolveSettlement: undefined as (() => void) | undefined,
}));

vi.mock("../replay/dom-inventory.ts", () => ({
  inventoryDom: vi.fn(),
}));

vi.mock("../evidence/evidence-capture.ts", () => ({
  captureRouteEvidence: vi.fn(),
}));

vi.mock("../replay/frozen-case-artifacts.ts", () => ({
  writeFrozenCaseArtifact: vi.fn(),
}));

vi.mock("../replay/frozen-case-live-actions.ts", () => ({
  actionFor: vi.fn(() => undefined),
  runAction: vi.fn(),
}));

vi.mock("../matrix/runtime-matrix-evidence.ts", () => ({
  eventsFor: vi.fn(() => ({
    consoleMessages: harness.runtimeEvents.consoleMessages,
    pageErrors: harness.runtimeEvents.pageErrors,
    requestFailures: harness.runtimeEvents.requestFailures,
    detach: vi.fn(() => {
      harness.events.push("listeners-detached");
    }),
  })),
}));

const resetHarness = (): void => {
  harness.events.length = 0;
  harness.runtimeEvents.consoleMessages.length = 0;
  harness.runtimeEvents.pageErrors.length = 0;
  harness.runtimeEvents.requestFailures.length = 0;
  harness.resolveSettlement = undefined;
};

describe("frozen-case initial navigation", () => {
  afterEach(resetHarness);

  it("captures runtime events emitted before the hydrated settlement boundary", async () => {
    let resolveStarted: (() => void) | undefined;
    const settlementStarted = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const settlement = new Promise<void>((resolve) => {
      harness.resolveSettlement = resolve;
    });
    const page = {
      url: () => "about:blank",
      goto: vi.fn(() => {
        harness.events.push("goto");
        return Promise.resolve({ status: () => 201 });
      }),
      waitForLoadState: vi.fn(async (state: string) => {
        expect(state).toBe("networkidle");
        harness.events.push("settlement-started");
        resolveStarted?.();
        await settlement;
        harness.events.push("settled");
      }),
      waitForFunction: vi.fn(() => Promise.resolve()),
    } as unknown as Page;

    const navigation = initialNavigation(page, "/head/report");
    await settlementStarted;

    harness.runtimeEvents.consoleMessages.push({
      type: "warning",
      text: "profile hydrated",
    });
    harness.runtimeEvents.pageErrors.push({ message: "hydrated page error" });
    harness.runtimeEvents.requestFailures.push({
      url: "http://127.0.0.1:3102/trpc/auth.me",
      failure: "timed out",
    });
    expect(harness.events).toEqual(["goto", "settlement-started"]);

    harness.resolveSettlement?.();
    await expect(navigation).resolves.toEqual({
      responseStatus: 201,
      events: {
        consoleMessages: [{ type: "warning", text: "profile hydrated" }],
        pageErrors: [{ message: "hydrated page error" }],
        requestFailures: [
          {
            url: "http://127.0.0.1:3102/trpc/auth.me",
            failure: "timed out",
          },
        ],
      },
    });
    expect(harness.events).toEqual([
      "goto",
      "settlement-started",
      "settled",
      "listeners-detached",
    ]);
  });
});
