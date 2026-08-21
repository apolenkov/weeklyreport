import { describe, expect, it, vi } from "vitest";

import type { MatrixExecutableCase } from "../../../matrix/matrix-finalizer.ts";
import { revealTransitionFor } from "../../../matrix/reveal-transition.ts";
import { revealSurfaceFor } from "../../../preflight/reveal-path.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../../../source/contracts.ts";
import type { DomInventory } from "../../dom/dom-inventory.ts";
import type { FrozenPhaseInput } from "../live/frozen-case-live-capture-types.ts";
import { frozenActionBoundaryOutcome } from "./frozen-case-action-boundary.ts";

const inventoryDomMock = vi.hoisted(() => vi.fn());
const domControlDisclosureMetadataMock = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("../../dom/dom-inventory.ts", () => ({
  RUNTIME_INTERACTION_EFFECTS: ["client-only", "mutation-required"],
  domControlDisclosureMetadataFor: domControlDisclosureMetadataMock,
  inventoryDom: inventoryDomMock,
}));

const control = (name: string) => ({
  controlKey: `button:${name}:0`,
  domOrderKey: `0000:button:${name}:0`,
  order: 0,
  role: "button",
  accessibleName: name,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});
const exactInventory: DomInventory = {
  controls: [control("Open")],
  issues: [],
};
const action = {
  controlKey: "button:Open:0",
  operation: "click" as const,
  safety: "read-only" as const,
  transition: "open" as const,
};
const surface = revealSurfaceFor(exactInventory.controls);
const transition = revealTransitionFor(
  action,
  surface,
  surface,
  "/lead/report#closed",
  "/lead/report#closed",
  {
    status: "unchanged",
    beforeDigest: "a".repeat(64),
    afterDigest: "a".repeat(64),
  },
);
const matrixCase = {
  caseId: "case-boundary",
  stateId: "state-boundary",
  sourceSha: "a".repeat(40),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report#closed",
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
  state: {
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "open",
  },
  kind: "executable",
  controlKey: action.controlKey,
  preparation: {
    revealPathDigest: "b".repeat(64),
    expectedSurfaceDigest: surface.digest,
    expectedActionTransitionDigest: transition.digest,
  },
  execution: { kind: "control", action },
} satisfies MatrixExecutableCase;
const input = {
  phase: "action",
  page: { url: () => "https://localhost/lead/report#closed" },
  source: {
    revealSurfacesByDigest: new Map([[surface.digest, surface]]),
    revealTransitionsByDigest: new Map([[transition.digest, transition]]),
  },
  matrixCase,
} as unknown as FrozenPhaseInput;

describe("frozen action boundary", () => {
  it("allows the exact surface immediately before the target action", async () => {
    inventoryDomMock.mockResolvedValueOnce(exactInventory);
    await expect(
      frozenActionBoundaryOutcome(input, action),
    ).resolves.toBeUndefined();
  });

  it("returns an ambiguous outcome without issuing a drifted target action", async () => {
    inventoryDomMock.mockResolvedValueOnce({
      controls: [control("Renamed")],
      issues: [],
    });
    const outcome = await frozenActionBoundaryOutcome(input, action);
    if (outcome === undefined || typeof outcome === "string")
      throw new Error("Expected a typed ambiguous boundary outcome");
    expect(outcome.status).toBe("ambiguous");
    expect(outcome.controlKey).toBe(action.controlKey);
    expect(outcome.reason).toMatch(/surface/u);
  });
});
