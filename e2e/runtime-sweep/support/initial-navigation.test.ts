import type { Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialNavigation } from "../replay/frozen-case/live/frozen-case-live-capture.ts";

const harness = vi.hoisted(() => ({
  events: [] as string[],
  runtimeEvents: {
    consoleMessages: [] as Readonly<{ type: string; text: string }>[],
    pageErrors: [] as Readonly<{ message: string }>[],
    requestFailures: [] as Readonly<{
      url: string;
      method: string;
      resourceType: string;
      failure: string | null;
      startedAt: string;
      endedAt: string;
      durationMs: number;
    }>[],
    responses: [] as Readonly<{
      url: string;
      method: string;
      resourceType: string;
      status: number;
      ok: boolean;
      startedAt: string;
      endedAt: string;
      durationMs: number;
      correlationId: string | null;
    }>[],
  },
  resolveSettlement: undefined as (() => void) | undefined,
}));

vi.mock("../replay/dom/dom-inventory.ts", () => ({
  RUNTIME_INTERACTION_EFFECTS: ["client-only", "mutation-required"],
  inventoryDom: vi.fn(),
}));

vi.mock("../evidence/evidence-capture.ts", () => ({
  captureRouteEvidence: vi.fn(),
}));

vi.mock("../replay/evidence/frozen-case-artifacts.ts", () => ({
  writeFrozenCaseArtifact: vi.fn(),
}));

vi.mock("../replay/frozen-case/live/frozen-case-live-actions.ts", () => ({
  actionFor: vi.fn(() => undefined),
  runAction: vi.fn(),
}));

vi.mock("../matrix/runtime-matrix-evidence.ts", () => ({
  eventsFor: vi.fn(() => {
    const cursor = () => ({
      consoleMessages: harness.runtimeEvents.consoleMessages.length,
      pageErrors: harness.runtimeEvents.pageErrors.length,
      requestFailures: harness.runtimeEvents.requestFailures.length,
      responses: harness.runtimeEvents.responses.length,
    });
    return {
      consoleMessages: harness.runtimeEvents.consoleMessages,
      pageErrors: harness.runtimeEvents.pageErrors,
      requestFailures: harness.runtimeEvents.requestFailures,
      responses: harness.runtimeEvents.responses,
      cursor,
      snapshot: vi.fn(() => ({ ...harness.runtimeEvents })),
      snapshotSince: vi.fn((start: ReturnType<typeof cursor>) => ({
        consoleMessages: harness.runtimeEvents.consoleMessages.slice(
          start.consoleMessages,
        ),
        pageErrors: harness.runtimeEvents.pageErrors.slice(start.pageErrors),
        requestFailures: harness.runtimeEvents.requestFailures.slice(
          start.requestFailures,
        ),
        responses: harness.runtimeEvents.responses.slice(start.responses),
      })),
      waitForIdle: vi.fn(() => Promise.resolve()),
      detach: vi.fn(() => {
        harness.events.push("listeners-detached");
      }),
    };
  }),
}));

const resetHarness = (): void => {
  harness.events.length = 0;
  harness.runtimeEvents.consoleMessages.length = 0;
  harness.runtimeEvents.pageErrors.length = 0;
  harness.runtimeEvents.requestFailures.length = 0;
  harness.runtimeEvents.responses.length = 0;
  harness.resolveSettlement = undefined;
};

describe("frozen-case initial navigation", () => {
  afterEach(resetHarness);

  it("captures runtime events emitted before the hydrated settlement boundary", async () => {
    const { promise: settlementStarted, resolve: resolveStarted } =
      Promise.withResolvers<void>();
    const settlement = new Promise<void>((resolve) => {
      harness.resolveSettlement = resolve;
    });
    let currentUrl = "about:blank";
    const page = {
      url: () => currentUrl,
      goto: vi.fn(() => {
        harness.events.push("goto");
        currentUrl = "http://127.0.0.1:3105/head/report";
        return Promise.resolve({ status: () => 201 });
      }),
      waitForLoadState: vi.fn(async (state: string) => {
        expect(state).toBe("networkidle");
        harness.events.push("settlement-started");
        resolveStarted();
        await settlement;
        harness.events.push("settled");
      }),
      waitForFunction: vi.fn(() => Promise.resolve()),
    } as unknown as Page;

    const navigation = initialNavigation(
      page,
      "/head/report",
      "/head/report",
      "http://127.0.0.1:3105",
    );
    await settlementStarted;

    harness.runtimeEvents.consoleMessages.push({
      type: "warning",
      text: "profile hydrated",
    });
    harness.runtimeEvents.pageErrors.push({ message: "hydrated page error" });
    harness.runtimeEvents.requestFailures.push({
      url: "http://127.0.0.1:3102/trpc/auth.me",
      method: "GET",
      resourceType: "fetch",
      failure: "timed out",
      startedAt: "2026-08-07T00:00:00.000Z",
      endedAt: "2026-08-07T00:00:00.100Z",
      durationMs: 100,
    });
    harness.runtimeEvents.responses.push({
      url: "http://127.0.0.1:3102/trpc/auth.me",
      method: "GET",
      resourceType: "fetch",
      status: 503,
      ok: false,
      startedAt: "2026-08-07T00:00:00.000Z",
      endedAt: "2026-08-07T00:00:00.100Z",
      durationMs: 100,
      correlationId: "initial-navigation-test",
    });
    expect(harness.events).toEqual(["goto", "settlement-started"]);

    harness.resolveSettlement?.();
    const result = await navigation;
    expect(result.responseStatus).toBe(201);
    expect(result.events.startedAt).toEqual(expect.any(String));
    expect(result.events.cursor).toEqual({
      consoleMessages: 0,
      pageErrors: 0,
      requestFailures: 0,
      responses: 0,
    });
    expect(result.events.collector.snapshotSince(result.events.cursor)).toEqual(
      {
        consoleMessages: [{ type: "warning", text: "profile hydrated" }],
        pageErrors: [{ message: "hydrated page error" }],
        requestFailures: [
          {
            url: "http://127.0.0.1:3102/trpc/auth.me",
            method: "GET",
            resourceType: "fetch",
            failure: "timed out",
            startedAt: "2026-08-07T00:00:00.000Z",
            endedAt: "2026-08-07T00:00:00.100Z",
            durationMs: 100,
          },
        ],
        responses: [
          {
            url: "http://127.0.0.1:3102/trpc/auth.me",
            method: "GET",
            resourceType: "fetch",
            status: 503,
            ok: false,
            startedAt: "2026-08-07T00:00:00.000Z",
            endedAt: "2026-08-07T00:00:00.100Z",
            durationMs: 100,
            correlationId: "initial-navigation-test",
          },
        ],
      },
    );
    expect(harness.events).toEqual(["goto", "settlement-started", "settled"]);
    result.events.collector.detach();
    expect(harness.events.at(-1)).toBe("listeners-detached");
  });
});
