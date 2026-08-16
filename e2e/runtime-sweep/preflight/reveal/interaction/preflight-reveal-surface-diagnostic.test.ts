import { describe, expect, it, vi } from "vitest";

import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { Action } from "../../../source/contracts.ts";
import { sha256Hex } from "../../../support/ids.ts";
import { revealSurfaceFor } from "../../reveal-path.ts";
import { liveRevealActionBoundary } from "./preflight-reveal-action-boundary.ts";
import type { RevealExecutionHarness } from "./preflight-reveal-types.ts";

const action: Action = {
  controlKey: "button:Open:1",
  operation: "click",
  safety: "read-only",
  transition: "open",
};

const control = (enabled: boolean): DomControlObservation => ({
  controlKey: action.controlKey,
  domOrderKey: `0001:${action.controlKey}`,
  order: 1,
  role: "button",
  accessibleName: "Open",
  enabled,
  disabled: !enabled,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});

const inventoryFor = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

const sentinelControls = (
  group: "actual" | "expected",
): readonly DomControlObservation[] =>
  Array.from({ length: 9 }, (_, index) => {
    const accessibleName = `${group} private name ${String(index)}`;
    const controlKey = `link:${encodeURIComponent(accessibleName)}:1`;
    return {
      controlKey,
      domOrderKey: `${String(index + 2).padStart(4, "0")}:${controlKey}`,
      order: index + 2,
      role: "link",
      accessibleName,
      enabled: true,
      disabled: false,
      visible: true,
      tagName: "a",
      inputType: null,
      href: `/private/${group}/${String(index)}?sensitive=value`,
    };
  });

const failureFor = async (input: {
  readonly expectedInventory: DomInventory;
  readonly actualInventory: DomInventory;
  readonly executeReveal: ReturnType<
    typeof vi.fn<RevealExecutionHarness["executeReveal"]>
  >;
}): Promise<Error> => {
  const harness: RevealExecutionHarness = {
    prepare: vi.fn(),
    navigate: vi.fn(),
    currentUrl: () => "http://127.0.0.1:3205/lead/report",
    inventory: () => Promise.resolve(input.actualInventory),
    executeReveal: input.executeReveal,
  };
  const failure = await liveRevealActionBoundary(
    harness,
    {
      inventory: input.expectedInventory,
      surface: revealSurfaceFor(input.expectedInventory.controls),
      url: "/lead/report",
    },
    action,
  ).catch((error: unknown) => error);
  if (!(failure instanceof Error)) throw failure;
  return failure;
};

describe("preflight reveal surface diagnostic", () => {
  it("reports a bounded field-level diff without exposing the control key", async () => {
    const expectedInventory = inventoryFor([control(true)]);
    const actualInventory = inventoryFor([control(false)]);
    const executeReveal = vi.fn<RevealExecutionHarness["executeReveal"]>();
    const failure = await failureFor({
      expectedInventory,
      actualInventory,
      executeReveal,
    });

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toContain(
      `expectedDigest=${revealSurfaceFor(expectedInventory.controls).digest}`,
    );
    expect(failure.message).toContain(
      `actualDigest=${revealSurfaceFor(actualInventory.controls).digest}`,
    );
    expect(failure.message).toMatch(/changed=\[[^\]]+fields=enabled[^\]]*\]/u);
    expect(failure.message).not.toContain(action.controlKey);
    expect(executeReveal).not.toHaveBeenCalled();
  });

  it("truncates every diff category and excludes raw sentinel values", async () => {
    const expectedOnly = sentinelControls("expected");
    const actualOnly = sentinelControls("actual");
    const expectedInventory = inventoryFor([control(true), ...expectedOnly]);
    const actualInventory = inventoryFor([control(false), ...actualOnly]);
    const executeReveal = vi.fn<RevealExecutionHarness["executeReveal"]>();
    const failure = await failureFor({
      expectedInventory,
      actualInventory,
      executeReveal,
    });
    const expectedSurface = revealSurfaceFor(expectedInventory.controls);
    const actualSurface = revealSurfaceFor(actualInventory.controls);
    const expectedKeys = new Set(
      expectedSurface.controls.map(({ controlKey }) => controlKey),
    );
    const actualKeys = new Set(
      actualSurface.controls.map(({ controlKey }) => controlKey),
    );
    const addedDigests = actualSurface.controls
      .filter(({ controlKey }) => !expectedKeys.has(controlKey))
      .map(({ controlKey }) => sha256Hex(controlKey));
    const removedDigests = expectedSurface.controls
      .filter(({ controlKey }) => !actualKeys.has(controlKey))
      .map(({ controlKey }) => sha256Hex(controlKey));

    expect(failure.message).toContain("expectedCount=10 actualCount=10");
    expect(failure.message).toContain(
      `expectedDigest=${expectedSurface.digest}`,
    );
    expect(failure.message).toContain(`actualDigest=${actualSurface.digest}`);
    expect(failure.message).toContain("truncated=true");
    for (const digest of [
      ...addedDigests.slice(0, 8),
      ...removedDigests.slice(0, 8),
    ])
      expect(failure.message).toContain(digest);
    expect(failure.message).not.toContain(addedDigests[8]);
    expect(failure.message).not.toContain(removedDigests[8]);
    for (const sentinel of [...expectedOnly, ...actualOnly]) {
      expect(failure.message).not.toContain(sentinel.controlKey);
      expect(failure.message).not.toContain(sentinel.accessibleName);
      expect(failure.message).not.toContain(sentinel.href);
    }
    expect(executeReveal).not.toHaveBeenCalled();
  });
});
