import type { Page } from "@playwright/test";
import { vi } from "vitest";

import {
  finalizeCampaignMatrix,
  type MatrixExecutableCase,
  type MatrixPreflightControl,
} from "../../matrix/matrix-finalizer.ts";
import {
  type RevealTransition,
  revealTransitionFor,
} from "../../matrix/reveal-transition.ts";
import type { RuntimeMatrixSource } from "../../matrix/runtime-matrix.ts";
import type { RevealNonMutationProof } from "../../preflight/reveal-path.ts";
import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../preflight/reveal-path.ts";
import type { Action } from "../../source/contracts.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../dom/dom-inventory.ts";

export const FIRST_SHOW_KEY = "button:Show%20action%20details:1";
export const SECOND_SHOW_KEY = "button:Show%20action%20details:2";
const FIRST_HIDE_KEY = "button:Hide%20action%20details:1";
const SECOND_HIDE_KEY = "button:Hide%20action%20details:2";
const DIGEST_LENGTH = 64;
const DOM_ORDER_WIDTH = 4;
const SHOW_ACTION = "Show action details";
const HIDE_ACTION = "Hide action details";
const FIRST_PANEL = "panel-row-1";
const SECOND_PANEL = "panel-row-2";

const disclosure = (
  controlKey: string,
  accessibleName: string,
  order: number,
  ariaControls: string,
  ariaExpanded: boolean,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(DOM_ORDER_WIDTH, "0")}:${controlKey}`,
  order,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ariaControls,
  ariaExpanded,
  disclosureIndependence: "source-bound-row-local",
});

export const rootInventory: DomInventory = {
  controls: [
    disclosure(FIRST_SHOW_KEY, SHOW_ACTION, 1, FIRST_PANEL, false),
    disclosure(SECOND_SHOW_KEY, SHOW_ACTION, 2, SECOND_PANEL, false),
  ],
  issues: [],
};

export const postFirstExpansionInventory: DomInventory = {
  controls: [
    disclosure(FIRST_HIDE_KEY, HIDE_ACTION, 1, FIRST_PANEL, true),
    disclosure(FIRST_SHOW_KEY, SHOW_ACTION, 2, SECOND_PANEL, false),
  ],
  issues: [],
};

export const afterSecondExpansionFromRootInventory: DomInventory = {
  controls: [
    disclosure(FIRST_SHOW_KEY, SHOW_ACTION, 1, FIRST_PANEL, false),
    disclosure(FIRST_HIDE_KEY, HIDE_ACTION, 2, SECOND_PANEL, true),
  ],
  issues: [],
};

export const afterSecondExpansionFromPostFirstInventory: DomInventory = {
  controls: [
    disclosure(FIRST_HIDE_KEY, HIDE_ACTION, 1, FIRST_PANEL, true),
    disclosure(SECOND_HIDE_KEY, HIDE_ACTION, 2, SECOND_PANEL, true),
  ],
  issues: [],
};

export const proof: RevealNonMutationProof = {
  status: "unchanged",
  beforeDigest: "d".repeat(DIGEST_LENGTH),
  afterDigest: "d".repeat(DIGEST_LENGTH),
};

const actionFor = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "open",
});

export const rootSurface = revealSurfaceFor(rootInventory.controls);
export const afterFirstExpansionSurface = revealSurfaceFor(
  postFirstExpansionInventory.controls,
);
export const afterSecondExpansionFromRootSurface = revealSurfaceFor(
  afterSecondExpansionFromRootInventory.controls,
);
export const afterSecondExpansionFromPostFirstSurface = revealSurfaceFor(
  afterSecondExpansionFromPostFirstInventory.controls,
);
export const firstExpansionPath = revealPathFor(
  [
    revealStepFor(
      actionFor(FIRST_SHOW_KEY),
      rootSurface,
      afterFirstExpansionSurface,
      "/lead",
      "/lead",
      proof,
    ),
  ],
  "/lead",
);
export const rootSecondAction = actionFor(SECOND_SHOW_KEY);
export const postFirstSecondAction = actionFor(FIRST_SHOW_KEY);
export const rootSecondTransition = revealTransitionFor(
  rootSecondAction,
  rootSurface,
  afterSecondExpansionFromRootSurface,
  "/lead",
  "/lead",
  proof,
);
export const postFirstSecondTransition = revealTransitionFor(
  postFirstSecondAction,
  afterFirstExpansionSurface,
  afterSecondExpansionFromPostFirstSurface,
  "/lead",
  "/lead",
  proof,
);

export const sourceFor = (
  path: ReturnType<typeof revealPathFor>,
  surfaces: readonly ReturnType<typeof revealSurfaceFor>[],
): RuntimeMatrixSource =>
  ({
    matrix: { revealPaths: [path], revealSurfaces: surfaces },
  }) as unknown as RuntimeMatrixSource;

export const fakePage = (urls: readonly string[]): Page =>
  ({
    url: urls.reduce((mock, value) => mock.mockReturnValueOnce(value), vi.fn()),
  }) as unknown as Page;

const preflightInventoryFor = (
  control: DomControlObservation,
): MatrixPreflightControl["inventory"] => ({
  ariaRole: control.role,
  accessibleName: control.accessibleName,
  enabled: control.enabled,
  order: control.order,
  domOrderKey: control.domOrderKey,
  href: control.href,
  ...(control.ariaControls === undefined
    ? {}
    : { ariaControls: control.ariaControls }),
  ...(control.ariaExpanded === undefined
    ? {}
    : { ariaExpanded: control.ariaExpanded }),
  ...(control.disclosureIndependence === undefined
    ? {}
    : { disclosureIndependence: control.disclosureIndependence }),
});

export const controlFor = (
  inventory: DomInventory,
  controlKey: string,
): DomControlObservation => {
  const control = inventory.controls.find(
    (candidate) => candidate.controlKey === controlKey,
  );
  if (control === undefined)
    throw new Error(`Fixture is missing control ${controlKey}`);
  return control;
};

export const preflightControlFor = (
  control: DomControlObservation,
  action: Action,
  path: ReturnType<typeof revealPathFor>,
  surface: ReturnType<typeof revealSurfaceFor>,
  expectedActionSurface: ReturnType<typeof revealSurfaceFor>,
  expectedActionTransition: RevealTransition,
): MatrixPreflightControl => ({
  controlKey: control.controlKey,
  inventory: preflightInventoryFor(control),
  action,
  revealPath: path,
  expectedSurface: surface,
  expectedActionSurface,
  expectedActionTransition,
});

export const executableControlCaseFor = (
  matrix: ReturnType<typeof finalizeCampaignMatrix>,
  controlKey: string,
): MatrixExecutableCase => {
  const matrixCase = matrix.cases.find(
    (candidate) =>
      "action" in candidate.execution &&
      candidate.execution.action.controlKey === controlKey,
  );
  if (matrixCase === undefined)
    throw new Error(`Finalized matrix is missing control ${controlKey}`);
  return matrixCase;
};
