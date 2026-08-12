import { describe, expect, it, vi } from "vitest";

import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { Action } from "../../../source/contracts.ts";
import { revealSurfaceFor } from "../../reveal-path.ts";
import {
  liveRevealActionBoundary,
  liveRevealExecutionUrl,
} from "./preflight-reveal-action-boundary.ts";
import type { RevealExecutionHarness } from "./preflight-reveal-types.ts";

const action: Action = {
  controlKey: "button:Open:1",
  operation: "click",
  safety: "read-only",
  transition: "open",
};

const control = (
  options: Readonly<Partial<DomControlObservation>> = {},
): DomControlObservation => ({
  controlKey: action.controlKey,
  domOrderKey: `0001:${action.controlKey}`,
  order: 1,
  role: "button",
  accessibleName: "Open",
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ...options,
});

const inventoryFor = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

const expectedInventory = inventoryFor([control()]);
const expectedBoundary = {
  inventory: expectedInventory,
  surface: revealSurfaceFor(expectedInventory.controls),
  url: "/lead/report?panel=closed#top",
} as const;

const absoluteBrowserUrl = (route: string): string =>
  new URL(route, "http://127.0.0.1:3205").href;

type RevealExecutor = RevealExecutionHarness["executeReveal"];
type RevealExecutorMock = ReturnType<typeof vi.fn<RevealExecutor>>;

const harnessFor = (input: {
  readonly url: string;
  readonly inventory: DomInventory;
  readonly executeReveal: RevealExecutorMock;
}): RevealExecutionHarness => ({
  prepare: vi.fn(),
  navigate: vi.fn(),
  currentUrl: () => input.url,
  inventory: () => Promise.resolve(input.inventory),
  executeReveal: input.executeReveal,
});

const attemptAction = async (
  harness: RevealExecutionHarness,
): Promise<void> => {
  const boundary = await liveRevealActionBoundary(
    harness,
    expectedBoundary,
    action,
  );
  await harness.executeReveal({
    control: boundary.control,
    action,
    preparation: undefined,
  });
};

describe("preflight reveal action boundary", () => {
  it("preserves the absolute same-origin URL for post-action origin validation", async () => {
    const rawUrl = "http://127.0.0.1:3205/lead/report?panel=closed#top";
    const boundary = await liveRevealActionBoundary(
      harnessFor({
        url: rawUrl,
        inventory: expectedInventory,
        executeReveal: vi.fn<RevealExecutor>(),
      }),
      expectedBoundary,
      action,
    );

    expect(boundary.rawUrl).toBe(rawUrl);
  });

  it("rejects an absolute cross-origin URL after the action", () => {
    const outside = "https://outside.example/lead/report";
    const harness = harnessFor({
      url: outside,
      inventory: expectedInventory,
      executeReveal: vi.fn<RevealExecutor>(),
    });

    expect(() =>
      liveRevealExecutionUrl(
        harness,
        outside,
        "http://127.0.0.1:3205/lead/report",
      ),
    ).toThrow(/browser origin/iu);
  });

  it("rejects same-origin URL drift before invoking the action", async () => {
    const executeReveal = vi.fn<RevealExecutor>();
    const harness = harnessFor({
      url: absoluteBrowserUrl("/lead/report?panel=drift#top"),
      inventory: expectedInventory,
      executeReveal,
    });

    await expect(attemptAction(harness)).rejects.toThrow(
      /URL drifted immediately before execution/iu,
    );
    expect(executeReveal).not.toHaveBeenCalled();
  });

  it("rejects a relative pre-action browser URL before invoking the action", async () => {
    const executeReveal = vi.fn<RevealExecutor>();
    const harness = harnessFor({
      url: expectedBoundary.url,
      inventory: expectedInventory,
      executeReveal,
    });

    await expect(attemptAction(harness)).rejects.toThrow(
      /current URL is invalid/iu,
    );
    expect(executeReveal).not.toHaveBeenCalled();
  });

  it("rejects a relative post-action browser URL", () => {
    const harness = harnessFor({
      url: "http://127.0.0.1:3205/lead/report",
      inventory: expectedInventory,
      executeReveal: vi.fn<RevealExecutor>(),
    });

    expect(() =>
      liveRevealExecutionUrl(
        harness,
        "/lead/report",
        "http://127.0.0.1:3205/lead/report",
      ),
    ).toThrow(/current URL is invalid/iu);
  });

  it("rejects transient semantic DOM drift before invoking the action", async () => {
    const executeReveal = vi.fn<RevealExecutor>();
    const harness = harnessFor({
      url: absoluteBrowserUrl(expectedBoundary.url),
      inventory: inventoryFor([
        control({ accessibleName: "Changed", enabled: false }),
      ]),
      executeReveal,
    });

    await expect(attemptAction(harness)).rejects.toThrow(
      /surface drifted immediately before execution/iu,
    );
    expect(executeReveal).not.toHaveBeenCalled();
  });
});
