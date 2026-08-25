import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { DomControlObservation } from "../../replay/dom/dom-inventory.ts";
import type { Action } from "../../source/contracts.ts";
import type { RevealNonMutationProof } from "../reveal-path.ts";

const mocks = vi.hoisted(() => ({
  executeControlAction: vi.fn(),
  inventoryDom: vi.fn(),
  observerFor: vi.fn(() => () => Promise.resolve("pass" as const)),
  snapshotPage: vi.fn(() => ({
    controls: [],
    dom: "",
    focus: "",
    network: 0,
    url: "https://runtime.invalid/reports",
  })),
  targetFor: vi.fn((control: unknown) => control),
}));

vi.mock("../../replay/control-actions/control-actions.ts", () => ({
  executeControlAction: mocks.executeControlAction,
}));
vi.mock("../../replay/dom/dom-inventory.ts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../replay/dom/dom-inventory.ts")
  >()),
  inventoryDom: mocks.inventoryDom,
}));
vi.mock("../../replay/live-control/live-control-observation.ts", () => ({
  snapshotPage: mocks.snapshotPage,
}));
vi.mock("../../replay/live-control/live-control-records.ts", () => ({
  observerFor: mocks.observerFor,
  targetFor: mocks.targetFor,
}));

import { createPlaywrightRevealExecutor } from "./playwright-reveal-execution.ts";

const control: DomControlObservation = {
  accessibleName: "Open",
  controlKey: "button:Open:1",
  disabled: false,
  domOrderKey: "0001:button:Open:1",
  enabled: true,
  href: null,
  inputType: null,
  order: 1,
  role: "button",
  tagName: "button",
  visible: true,
};

const action: Action = {
  controlKey: control.controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
};

const proof: RevealNonMutationProof = {
  afterDigest: "a".repeat(64),
  beforeDigest: "a".repeat(64),
  status: "unchanged",
};

const page = Object.assign({} as Page, {
  url: () => "https://runtime.invalid/reports",
});

const preparation = {
  proveNonMutation: async (
    revealAction: () => Promise<void>,
  ): Promise<RevealNonMutationProof> => {
    await revealAction();
    return proof;
  },
};

describe("Playwright reveal execution failure diagnostics", () => {
  it.each([
    ["not-exercised", "Control is not present in the live DOM"],
    ["fail", "No observable outcome was produced"],
  ] as const)("keeps the %s reason", async (status, reason) => {
    mocks.executeControlAction.mockReturnValueOnce({
      controlKey: control.controlKey,
      operation: "click",
      resetPerformed: false,
      status,
      reason,
    });

    const executeReveal = createPlaywrightRevealExecutor({ page });
    await expect(
      executeReveal({ action, control, preparation }),
    ).rejects.toThrow(
      `Reveal action did not reach terminal pass: ${control.controlKey}; status=${status}; reason=${reason}`,
    );
  });

  it("normalizes and bounds an observer failure reason", async () => {
    const rawReason = `${"line-one\nline-two\t".repeat(30)}SENTINEL_AFTER_BOUND`;
    const expectedReason = rawReason
      .replaceAll(/\s+/gu, " ")
      .trim()
      .slice(0, 240);

    mocks.executeControlAction.mockReturnValueOnce({
      controlKey: control.controlKey,
      operation: "click",
      resetPerformed: false,
      status: "fail",
      reason: rawReason,
    });

    const executeReveal = createPlaywrightRevealExecutor({ page });
    await expect(
      executeReveal({ action, control, preparation }),
    ).rejects.toThrow(
      `Reveal action did not reach terminal pass: ${control.controlKey}; status=fail; reason=${expectedReason}`,
    );
    expect(expectedReason).toHaveLength(240);
    expect(expectedReason).not.toContain("SENTINEL_AFTER_BOUND");
  });
});
