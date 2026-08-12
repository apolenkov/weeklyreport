import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import { finalizeCampaignMatrix } from "../../../matrix/matrix-finalizer.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { CampaignManifest } from "../../../source/contracts.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
  type RevealRoute,
} from "../interaction/preflight-reveal-discovery.ts";

const route: RevealRoute = { resolvedRoute: "/lead/report" };
const DATABASE_DIGEST = "d".repeat(64);

const observation = (
  controlKey: string,
  accessibleName: string,
  role = "button",
  order = 0,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
  order,
  role,
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: role === "dialog" ? "section" : "button",
  inputType: null,
  href: null,
});

const inventory = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

const duplicateDialogState: CampaignMatrixState = {
  profile: "minimal",
  stateId: "duplicate-dialog-state",
  pairwiseDigest: "b".repeat(64),
  axes: {
    role: "lead",
    route: "lead:/lead/report",
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};

const duplicateDialogDeclaration: CampaignManifest["matrixDeclaration"] = {
  generatorSeed: "duplicate-dialog",
  axes: {
    role: ["lead"],
    route: ["lead:/lead/report"],
    profileCapability: ["canonical-identities"],
    lifecycle: ["open"],
    submission: ["draft"],
    ownershipDensity: ["single"],
    permission: ["allowed"],
    fault: ["none"],
    controlTransition: ["none"],
  },
  constraints: [],
};

const duplicateDialogPlan = {
  states: [duplicateDialogState],
  inapplicable: [],
  digest: "duplicate-dialog-plan",
} satisfies Parameters<typeof finalizeCampaignMatrix>[0]["plan"];

const duplicateDialogRoutes: CampaignManifest["routes"] = [
  {
    role: "lead",
    catalogRoute: "/lead/report",
    resolvedRoute: "/lead/report",
    landingRoute: "/lead/report",
    networkPolicy: null,
    bindings: [
      {
        status: "assigned",
        profile: "minimal",
        target: "none",
        requiredCapability: "canonical-identities",
        resolvedRoute: "/lead/report",
        landingRoute: "/lead/report",
        rationale: "duplicate dialog fixture",
      },
    ],
  },
];

type DialogMode = "root" | "add" | "edit";

const duplicateDialogFixture = (): RevealExecutionHarness & {
  readonly initialInventory: DomInventory;
} => {
  const add = observation("button:Add new user:0", "Add new user", "button", 0);
  const edit = observation("button:Edit user:0", "Edit user", "button", 1);
  const cancel = observation("button:Cancel:1", "Cancel", "button", 0);
  const addDialog = observation("dialog:Add user:0", "Add user", "dialog", 1);
  const editDialog = observation(
    "dialog:Edit user:0",
    "Edit user",
    "dialog",
    1,
  );
  const root = inventory([add, edit]);
  const surfaces = {
    add: inventory([cancel, addDialog]),
    edit: inventory([cancel, editDialog]),
  } as const;
  const events = vi.fn<(event: string) => void>();
  const modeFor = (): DialogMode => {
    const values = events.mock.calls.map(([event]) => event);
    const event = values
      .slice(values.lastIndexOf("prepare") + 1)
      .toReversed()
      .find((value) => value.startsWith("execute:"));
    return event === `execute:${add.controlKey}`
      ? "add"
      : event === `execute:${edit.controlKey}`
        ? "edit"
        : "root";
  };
  const pathFor = (mode: DialogMode): string =>
    mode === "add"
      ? "/lead/report?dialog=add"
      : mode === "edit"
        ? "/lead/report?dialog=edit"
        : "/lead/report";
  const inventoryFor = (mode: DialogMode): DomInventory =>
    mode === "root" ? root : surfaces[mode];
  const harness: RevealExecutionHarness = {
    prepare: () => {
      events("prepare");
      return Promise.resolve();
    },
    navigate: () => {
      events("navigate");
      return Promise.resolve();
    },
    currentUrl: () => new URL(pathFor(modeFor()), "http://127.0.0.1:3205").href,
    inventory: () => Promise.resolve(inventoryFor(modeFor())),
    executeReveal: ({ action }) => {
      events(`execute:${action.controlKey}`);
      const mode = modeFor();
      return Promise.resolve({
        url: new URL(pathFor(mode), "http://127.0.0.1:3205").href,
        inventory: inventoryFor(mode),
        nonMutation: {
          status: "unchanged" as const,
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  return { ...harness, initialInventory: root };
};

describe("scoped reveal control identity", () => {
  it("keeps same-key Cancel controls bound to Add and Edit preparations", async () => {
    const fixture = duplicateDialogFixture();
    const controls = await discoverRevealControls({
      state: duplicateDialogState,
      route,
      initialInventory: fixture.initialInventory,
      harness: fixture,
      controlFor: preflightControlForPlan,
    });
    const cancelControls = controls.filter(
      ({ controlKey }) => controlKey === "button:Cancel:1",
    );
    expect(cancelControls).toHaveLength(2);
    expect(
      new Set(
        cancelControls.map(({ revealPath }) => revealPath.steps[0]?.controlKey),
      ),
    ).toEqual(new Set(["button:Add new user:0", "button:Edit user:0"]));
    expect(
      new Set(
        cancelControls.map(({ expectedSurface }) => expectedSurface.digest),
      ).size,
    ).toBe(2);
    expect(
      new Set(
        cancelControls.map(
          ({ expectedActionTransition }) => expectedActionTransition?.digest,
        ),
      ).size,
    ).toBe(2);
    cancelControls.forEach((control) => {
      expect(control.expectedActionTransition?.beforeSurfaceDigest).toBe(
        control.expectedSurface.digest,
      );
      expect(control.expectedActionTransition?.afterSurfaceDigest).toBe(
        control.expectedActionSurface?.digest,
      );
    });
    const matrix = finalizeCampaignMatrix({
      sourceSha: "b".repeat(40),
      declaration: duplicateDialogDeclaration,
      plan: duplicateDialogPlan,
      routes: duplicateDialogRoutes,
      preflight: [{ state: duplicateDialogState, controls, specialized: [] }],
    });
    const cancelCases = matrix.cases.filter(
      ({ controlKey }) => controlKey === "button:Cancel:1",
    );
    expect(cancelCases).toHaveLength(2);
    expect(new Set(cancelCases.map(({ caseId }) => caseId)).size).toBe(2);
    const exactDuplicate = cancelControls[0];
    if (exactDuplicate === undefined)
      throw new Error("Expected one scoped Cancel control");
    expect(() =>
      finalizeCampaignMatrix({
        sourceSha: "b".repeat(40),
        declaration: duplicateDialogDeclaration,
        plan: duplicateDialogPlan,
        routes: duplicateDialogRoutes,
        preflight: [
          {
            state: duplicateDialogState,
            controls: [...controls, exactDuplicate],
            specialized: [],
          },
        ],
      }),
    ).toThrow(/duplicate controls/iu);
  });
});
