import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EvidenceBundle } from "./contracts.ts";
import type { DomInventory } from "./dom-inventory.ts";
import type { FrozenPhaseInput } from "./frozen-case-live-capture.ts";
import { captureFrozenPhase } from "./frozen-case-live-capture.ts";

const harness = vi.hoisted(() => ({
  events: [] as string[],
  frame: undefined as object | undefined,
  resolveNavigation: undefined as ((frame: object) => void) | undefined,
  delayMs: 10,
  navigationPath: "/",
  actionSucceeded: undefined as boolean | undefined,
}));

vi.mock("./dom-inventory.ts", () => ({
  inventoryDom: vi.fn(() => {
    harness.events.push("inventory");
    return Promise.resolve({ controls: [], issues: [] });
  }),
}));

vi.mock("./evidence-capture.ts", () => ({
  captureRouteEvidence: vi.fn(
    (input: {
      readonly functionalAssertion: {
        readonly actual: { readonly actionSucceeded: boolean };
      };
    }) => {
      harness.events.push("evidence");
      harness.actionSucceeded =
        input.functionalAssertion.actual.actionSucceeded;
      const bundle: EvidenceBundle = {
        before: [],
        action: [],
        after: [],
        observations: [],
        inapplicable: [],
      };
      return Promise.resolve({ bundle });
    },
  ),
}));

vi.mock("./frozen-case-artifacts.ts", () => ({
  writeFrozenCaseArtifact: vi.fn(() =>
    Promise.resolve({
      artifactId: "control-action",
      kind: "control-action",
      dimension: "runtime",
      archivePath: "/archive/control-actions.json",
      digest: "a".repeat(64),
      capturedAt: "2026-08-05T00:00:00.000Z",
      cellId: "case-sign-out",
      sourceSha: "a".repeat(40),
      profile: "minimal",
      role: "admin",
      catalogRoute: "/head/report",
      resolvedRoute: "/head/report",
    }),
  ),
}));

vi.mock("./frozen-case-live-actions.ts", () => ({
  actionFor: () => ({
    controlKey: "button:Sign%20out:1",
    operation: "click",
    safety: "read-only",
    transition: "none",
  }),
  runAction: vi.fn(() => {
    harness.events.push("action-result");
    setTimeout(() => {
      harness.events.push("navigation-start");
      if (harness.frame !== undefined)
        harness.resolveNavigation?.(harness.frame);
    }, harness.delayMs);
    return Promise.resolve({
      status: "pass",
      controlKey: "button:Sign%20out:1",
      observation: { kind: "network", detail: "logout request" },
    });
  }),
}));

vi.mock("./runtime-matrix-evidence.ts", () => ({
  eventsFor: () => ({
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    detach: vi.fn(),
  }),
}));

const fakeInput = (page: object): FrozenPhaseInput =>
  ({
    page,
    source: {},
    matrixCase: {
      caseId: "case-sign-out",
      sourceSha: "a".repeat(40),
      profile: "minimal",
      role: "admin",
      catalogRoute: "/head/report",
      resolvedRoute: "/head/report",
      execution: {
        kind: "control",
        action: {
          controlKey: "button:Sign%20out:1",
          operation: "click",
          safety: "read-only",
          transition: "none",
        },
      },
    },
    runtime: {},
    prepared: {
      plan: {
        surface: {
          productContent: "available",
          productActions: "exercise",
          productActionsReason: null,
          shell: "required",
        },
      },
    },
    route: "/head/report",
    responseStatus: 200,
    phase: "action",
    initialEvents: {
      consoleMessages: [],
      pageErrors: [],
      requestFailures: [],
    },
  }) as unknown as FrozenPhaseInput;

describe("frozen action evidence capture", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shares the captured phase inventory with the frozen-case consumer", async () => {
    const observed: { value?: DomInventory } = {};

    await captureFrozenPhase({
      ...fakeInput({}),
      phase: "before",
      onInventory: (inventory) => {
        observed.value = inventory;
      },
    });

    expect(observed.value).toEqual({ controls: [], issues: [] });
  });

  it("waits for delayed sign-out navigation beyond the ordinary action grace", async () => {
    harness.events.length = 0;
    harness.frame = undefined;
    harness.resolveNavigation = undefined;
    harness.delayMs = 150;
    harness.navigationPath = "/";
    harness.actionSucceeded = undefined;
    const mainFrame = {};
    harness.frame = mainFrame;
    const pageState = { url: "http://127.0.0.1:3105/head/report" };
    const page = {
      url: () => pageState.url,
      mainFrame: () => mainFrame,
      waitForEvent: vi.fn(
        (
          _event: string,
          options: {
            readonly predicate?: (frame: object) => boolean;
            readonly signal?: AbortSignal;
          },
        ) =>
          new Promise<object>((resolve, reject) => {
            harness.events.push("observer-armed");
            harness.resolveNavigation = (frame) => {
              if (options.predicate?.(frame) === true) {
                pageState.url = `http://127.0.0.1:3105${harness.navigationPath}`;
                resolve(frame);
              }
            };
            options.signal?.addEventListener(
              "abort",
              () => reject(new Error("observer cancelled")),
              { once: true },
            );
          }),
      ),
      waitForLoadState: vi.fn(() => {
        harness.events.push("settled");
        return Promise.resolve();
      }),
      waitForFunction: vi.fn(() => Promise.resolve()),
    };

    const capture = captureFrozenPhase(fakeInput(page));
    await vi.advanceTimersByTimeAsync(harness.delayMs);
    const result = await capture;
    expect(result.action).toHaveLength(1);

    expect(harness.events).toEqual([
      "observer-armed",
      "action-result",
      "navigation-start",
      "settled",
      "inventory",
      "evidence",
    ]);
    expect(harness.actionSucceeded).toBe(true);
  });

  it("fails closed when sign out settles at an unexpected pathname", async () => {
    harness.events.length = 0;
    harness.frame = undefined;
    harness.resolveNavigation = undefined;
    harness.delayMs = 10;
    harness.navigationPath = "/login";
    harness.actionSucceeded = undefined;
    const mainFrame = {};
    harness.frame = mainFrame;
    const pageState = { url: "http://127.0.0.1:3105/head/report" };
    const page = {
      url: () => pageState.url,
      mainFrame: () => mainFrame,
      waitForEvent: vi.fn(
        (
          _event: string,
          options: {
            readonly predicate?: (frame: object) => boolean;
            readonly signal?: AbortSignal;
          },
        ) =>
          new Promise<object>((resolve, reject) => {
            harness.resolveNavigation = (frame) => {
              if (options.predicate?.(frame) === true) {
                pageState.url = `http://127.0.0.1:3105${harness.navigationPath}`;
                resolve(frame);
              }
            };
            options.signal?.addEventListener(
              "abort",
              () => reject(new Error("observer cancelled")),
              { once: true },
            );
          }),
      ),
      waitForLoadState: vi.fn(() => {
        harness.events.push("settled");
        return Promise.resolve();
      }),
      waitForFunction: vi.fn(() => Promise.resolve()),
    };

    const capture = captureFrozenPhase(fakeInput(page));
    await vi.advanceTimersByTimeAsync(harness.delayMs);
    const result = await capture;

    expect(result.action).toHaveLength(1);
    expect(harness.actionSucceeded).toBe(false);
  });
});
