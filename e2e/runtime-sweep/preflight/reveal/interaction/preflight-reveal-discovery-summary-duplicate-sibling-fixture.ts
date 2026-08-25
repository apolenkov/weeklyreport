import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { RevealExecutionHarness } from "./preflight-reveal-discovery.ts";

const ORIGIN = "http://127.0.0.1:3205";
const ROUTE = "/admin";
const DIGEST_LENGTH = 64;
const DOM_ORDER_WIDTH = 4;
const SHOW_ACTION = "Show action details";
const HIDE_ACTION = "Hide action details";
const FIRST_PANEL = "panel-row-1";
const SECOND_PANEL = "panel-row-2";
const DATABASE_DIGEST = "d".repeat(DIGEST_LENGTH);
const AFTER_FIRST_STATE = "after-first" as const;

const control = (
  controlKey: string,
  accessibleName: string,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `0001:${controlKey}`,
  order: 1,
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

const browserUrlFor = (path: string): string => new URL(path, ORIGIN).href;

const disclosure = (
  controlKey: string,
  accessibleName: string,
  order: number,
  ariaControls: string,
  ariaExpanded: boolean,
  enabled = true,
): DomControlObservation => ({
  ...control(controlKey, accessibleName),
  order,
  domOrderKey: `${String(order).padStart(DOM_ORDER_WIDTH, "0")}:${controlKey}`,
  enabled,
  disabled: !enabled,
  ariaControls,
  ariaExpanded,
  disclosureIndependence: "source-bound-row-local",
});

export const duplicateSiblingLifecycleFixture = (): Readonly<{
  readonly harness: RevealExecutionHarness;
  readonly initialInventory: DomInventory;
  readonly attemptedActions: readonly string[];
}> => {
  const firstShowKey = "button:Show%20action%20details:1";
  const secondShowKey = "button:Show%20action%20details:2";
  const root = inventory([
    disclosure(firstShowKey, SHOW_ACTION, 1, FIRST_PANEL, false),
    disclosure(secondShowKey, SHOW_ACTION, 2, SECOND_PANEL, false),
  ]);
  const afterFirst = inventory([
    disclosure(
      "button:Hide%20action%20details:1",
      HIDE_ACTION,
      1,
      FIRST_PANEL,
      true,
      false,
    ),
    disclosure(firstShowKey, SHOW_ACTION, 2, SECOND_PANEL, false),
  ]);
  // The harness deliberately tracks the currently rendered sibling state.
  const state = { current: "root" as "root" | typeof AFTER_FIRST_STATE };
  const attemptedActions: string[] = [];
  const resultFor = (next: "root" | typeof AFTER_FIRST_STATE) => {
    state.current = next;
    const nextInventory = next === "root" ? root : afterFirst;
    return {
      url: browserUrlFor(ROUTE),
      inventory: nextInventory,
      nonMutation: {
        status: "unchanged" as const,
        beforeDigest: DATABASE_DIGEST,
        afterDigest: DATABASE_DIGEST,
      },
    };
  };
  const harness: RevealExecutionHarness = {
    prepare: () => {
      state.current = "root";
      return Promise.resolve();
    },
    navigate: () => {
      state.current = "root";
      return Promise.resolve();
    },
    currentUrl: () => browserUrlFor(ROUTE),
    inventory: () =>
      Promise.resolve(state.current === "root" ? root : afterFirst),
    executeReveal: ({ action }) => {
      attemptedActions.push(`${state.current}:${action.controlKey}`);
      if (state.current === "root" && action.controlKey === firstShowKey)
        return Promise.resolve(resultFor(AFTER_FIRST_STATE));
      if (state.current === "root" && action.controlKey === secondShowKey)
        return Promise.resolve(resultFor("root"));
      if (
        state.current === AFTER_FIRST_STATE &&
        action.controlKey === firstShowKey
      )
        return Promise.resolve(resultFor(AFTER_FIRST_STATE));
      return Promise.reject(
        new Error(
          `Unknown duplicate sibling action: ${state.current}/${action.controlKey}`,
        ),
      );
    },
  };
  return { harness, initialInventory: root, attemptedActions };
};
