import { describe, expect, it } from "vitest";

import type { MatrixExecutableCase } from "../../../matrix/matrix-finalizer.ts";
import { revealTransitionFor } from "../../../matrix/reveal-transition.ts";
import type { RuntimeMatrixSource } from "../../../matrix/runtime-matrix.ts";
import { revealSurfaceFor } from "../../../preflight/reveal-path.ts";
import type { Action } from "../../../source/contracts.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../../../source/contracts.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../dom/dom-inventory.ts";
import { frozenActionTransitionIssues } from "./frozen-action-transition-validation.ts";

const HASH = "a".repeat(64);
const action: Action = {
  controlKey: "button:Open:1",
  operation: "click",
  safety: "read-only",
  transition: "open",
};

const control = (
  accessibleName: string,
  order: number,
  overrides: Partial<DomControlObservation> = {},
): DomControlObservation => ({
  controlKey: `button:${accessibleName}:1`,
  domOrderKey: `${String(order).padStart(4, "0")}:button:${accessibleName}:1`,
  order,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ...overrides,
});

const beforeInventory: DomInventory = {
  controls: [control("Open", 0), control("Stable", 1)],
  issues: [],
};
const afterInventory: DomInventory = {
  controls: [control("Open", 0), control("Dialog action", 1)],
  issues: [],
};
const beforeSurface = revealSurfaceFor(beforeInventory.controls);
const afterSurface = revealSurfaceFor(afterInventory.controls);
const transition = revealTransitionFor(
  action,
  beforeSurface,
  afterSurface,
  "/lead/report?view=form#top",
  "/lead/report?view=form#dialog",
  { status: "unchanged", beforeDigest: HASH, afterDigest: HASH },
);
const matrixCase = {
  caseId: "case-reveal",
  stateId: "state-reveal",
  sourceSha: "a".repeat(40),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report?view=form#top",
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
    revealPathDigest: HASH,
    expectedSurfaceDigest: beforeSurface.digest,
    expectedActionTransitionDigest: transition.digest,
  },
  execution: { kind: "control", action },
} satisfies MatrixExecutableCase;
const source = {
  matrix: { revealTransitions: [transition] },
  revealSurfacesByDigest: new Map([
    [beforeSurface.digest, beforeSurface],
    [afterSurface.digest, afterSurface],
  ]),
  revealTransitionsByDigest: new Map([[transition.digest, transition]]),
} as unknown as RuntimeMatrixSource;

const issuesFor = (
  after: DomInventory,
  afterUrl = "/lead/report?view=form#dialog",
): readonly string[] =>
  frozenActionTransitionIssues({
    source,
    matrixCase,
    before: {
      inventory: beforeInventory,
      url: "https://localhost/lead/report?view=form#top",
    },
    after: { inventory: after, url: `https://localhost${afterUrl}` },
  });

const changedAfter = (
  transform: (
    controls: readonly DomControlObservation[],
  ) => readonly DomControlObservation[],
): DomInventory => ({
  controls: transform(afterInventory.controls),
  issues: [],
});

describe("frozen action transition validation", () => {
  it("accepts the exact frozen surfaces and URLs", () => {
    expect(issuesFor(afterInventory)).toEqual([]);
  });

  it.each([
    [
      "unknown",
      changedAfter((controls) => [...controls, control("Unexpected", 2)]),
      /unknown controls/u,
    ],
    [
      "missing",
      changedAfter((controls) => controls.slice(0, 1)),
      /missing controls/u,
    ],
    [
      "reordered",
      changedAfter((controls) =>
        controls.map((entry, index) => ({
          ...entry,
          order: controls.length - index - 1,
        })),
      ),
      /signature drift/u,
    ],
    [
      "renamed",
      changedAfter((controls) =>
        controls.map((entry, index) =>
          index === 1 ? { ...entry, accessibleName: "Renamed" } : entry,
        ),
      ),
      /signature drift/u,
    ],
    [
      "enabled",
      changedAfter((controls) =>
        controls.map((entry, index) =>
          index === 1 ? { ...entry, enabled: false } : entry,
        ),
      ),
      /signature drift/u,
    ],
    [
      "href",
      changedAfter((controls) =>
        controls.map((entry, index) =>
          index === 1 ? { ...entry, href: "/drift" } : entry,
        ),
      ),
      /signature drift/u,
    ],
  ])("rejects %s post-action drift", (_kind, inventory, pattern) => {
    expect(issuesFor(inventory).join("; ")).toMatch(pattern);
  });

  it("rejects exact query or hash drift", () => {
    expect(
      issuesFor(afterInventory, "/lead/report?view=form#other").join("; "),
    ).toMatch(/after action URL drift/u);
  });
});
