import { expect, test, vi } from "vitest";

import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../replay/dom-inventory.ts";
import { preflightControlForPlan } from "./playwright-preflight.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
} from "./preflight-reveal-discovery.ts";

const route = { resolvedRoute: "/lead/report" } as const;
const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "state-00000001",
  pairwiseDigest: "a".repeat(64),
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
const observation = (
  controlKey: string,
  accessibleName: string,
  order: number,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
  order,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});
const inventory = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });
const absoluteBrowserUrl = (path: string): string =>
  new URL(path, "http://127.0.0.1:3205").href;
const DATABASE_DIGEST = "d".repeat(64);
const MODAL_OPEN = observation("button:Add%20new%20user:1", "Add new user", 0);
const MODAL_BACKGROUND_OPEN: DomControlObservation = {
  ...MODAL_OPEN,
  keyboardExpectedFocusable: false,
  keyboardFocusPolicy: "forbidden",
  keyboardFocusScope: "background",
};
const MODAL_DIALOG: DomControlObservation = {
  ...observation("dialog:Add%20user:1", "Add user", 1),
  role: "dialog",
  keyboardExpectedFocusable: false,
  keyboardFocusPolicy: "unreachable",
  keyboardFocusScope: "active-modal",
};
const MODAL_CANCEL: DomControlObservation = {
  ...observation("button:Cancel:1", "Cancel", 2),
  keyboardExpectedFocusable: true,
  keyboardFocusPolicy: "required",
  keyboardFocusScope: "active-modal",
};
const MODAL_INITIAL_INVENTORY = inventory([MODAL_OPEN]);
const MODAL_INVENTORY = inventory([
  MODAL_BACKGROUND_OPEN,
  MODAL_DIALOG,
  MODAL_CANCEL,
]);

const modalHarnessFor = (): Readonly<{
  readonly events: () => readonly string[];
  readonly harness: RevealExecutionHarness;
}> => {
  const recordEvent = vi.fn<(event: string) => void>();
  const events = (): readonly string[] =>
    recordEvent.mock.calls.map(([event]) => event);
  const actionsSincePreparation = (): readonly string[] => {
    const preparationStart = events().lastIndexOf("prepare");
    return events()
      .slice(preparationStart + 1)
      .filter((event) => event.startsWith("execute:"))
      .map((event) => event.slice("execute:".length));
  };
  const currentInventory = (): DomInventory =>
    actionsSincePreparation().at(-1) === MODAL_OPEN.controlKey
      ? MODAL_INVENTORY
      : MODAL_INITIAL_INVENTORY;
  const harness: RevealExecutionHarness = {
    prepare: () => {
      recordEvent("prepare");
      return Promise.resolve();
    },
    navigate: () => Promise.resolve(),
    currentUrl: () => absoluteBrowserUrl("/lead/report"),
    inventory: () => Promise.resolve(currentInventory()),
    executeReveal: ({ action }) => {
      if (
        action.controlKey === MODAL_OPEN.controlKey &&
        currentInventory() === MODAL_INVENTORY
      )
        throw new Error("Background modal control was executed");
      recordEvent(`execute:${action.controlKey}`);
      return Promise.resolve({
        url: absoluteBrowserUrl("/lead/report"),
        inventory: currentInventory(),
        nonMutation: {
          status: "unchanged",
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  return { events, harness };
};

test("keeps the first path for a shared semantic surface", async () => {
  const first = observation("button:Open first:0", "Open first", 0);
  const second = observation("button:Open second:0", "Open second", 1);
  const shared = observation("button:Shared details:0", "Shared details", 0);
  const sharedInventory = inventory([shared]);
  const initialInventory = inventory([first, second]);
  const recordEvent = vi.fn<(event: string) => void>();
  const currentInventory = (): DomInventory => {
    const events = recordEvent.mock.calls.map(([event]) => event);
    const preparationStart = events.lastIndexOf("prepare");
    const executedControls = events
      .slice(preparationStart + 1)
      .filter((event) => event.startsWith("execute:"))
      .map((event) => event.slice("execute:".length));
    return executedControls.some(
      (controlKey) =>
        controlKey === first.controlKey || controlKey === second.controlKey,
    )
      ? sharedInventory
      : initialInventory;
  };
  const harness: RevealExecutionHarness = {
    prepare: () => {
      recordEvent("prepare");
      return Promise.resolve();
    },
    navigate: () => Promise.resolve(),
    currentUrl: () => absoluteBrowserUrl("/lead/report"),
    inventory: () => Promise.resolve(currentInventory()),
    executeReveal: ({ action }) => {
      recordEvent(`execute:${action.controlKey}`);
      return Promise.resolve({
        url: absoluteBrowserUrl("/lead/report"),
        inventory: currentInventory(),
        nonMutation: {
          status: "unchanged",
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  const controls = await discoverRevealControls({
    state,
    route,
    initialInventory,
    harness,
    controlFor: preflightControlForPlan,
  });
  const sharedControls = controls.filter(
    ({ controlKey }) => controlKey === shared.controlKey,
  );

  expect(sharedControls).toHaveLength(1);
  expect(
    new Set(sharedControls.map(({ revealPath }) => revealPath.digest)).size,
  ).toBe(1);
});

test("does not re-execute a persistent background control behind a modal", async () => {
  const fixture = modalHarnessFor();

  const controls = await discoverRevealControls({
    state,
    route,
    initialInventory: MODAL_INITIAL_INVENTORY,
    harness: fixture.harness,
    controlFor: preflightControlForPlan,
  });
  const executions = fixture
    .events()
    .filter((event) => event.startsWith("execute:"));

  expect(executions).toEqual([
    `execute:${MODAL_OPEN.controlKey}`,
    `execute:${MODAL_OPEN.controlKey}`,
    `execute:${MODAL_CANCEL.controlKey}`,
  ]);
  expect(
    controls.find(
      ({ controlKey, revealPath }) =>
        controlKey === MODAL_OPEN.controlKey && revealPath.steps.length === 1,
    ),
  ).toBeUndefined();
});
