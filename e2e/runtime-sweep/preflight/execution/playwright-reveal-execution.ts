import type { Page } from "@playwright/test";

import {
  expectedActionNavigationFor,
  observeActionNavigation,
} from "../../replay/control-actions/action-navigation-boundary.ts";
import { SUPPORTED_CONTROL_ROLES } from "../../replay/control-actions/control-action-roles.ts";
import { executeControlAction } from "../../replay/control-actions/control-actions.ts";
import { targetLocator } from "../../replay/control-target/rendered-control-target.ts";
import { inventoryDom } from "../../replay/dom/dom-inventory.ts";
import { snapshotPage } from "../../replay/live-control/live-control-observation.ts";
import type { LiveControlObservation } from "../../replay/live-control/live-control-planning.ts";
import {
  observerFor,
  targetFor,
} from "../../replay/live-control/live-control-records.ts";
import type { RevealRepresentativeInput } from "../reveal/interaction/preflight-reveal-transition.ts";
import { representativeInputForFill } from "../reveal/interaction/preflight-reveal-transition.ts";
import type {
  RevealExecution,
  RevealExecutionHarness,
} from "../reveal/interaction/preflight-reveal-types.ts";
import type { RevealSurface, RevealSurfaceControl } from "../reveal-path.ts";
import { settleRevealActionNavigation } from "./playwright-reveal-navigation.ts";
import { captureRevealExecutionObservation } from "./playwright-reveal-observation.ts";

const REVEAL_TIMEOUT_MS = 10_000;
const REVEAL_DATA_READY_TIMEOUT_MS = 5000;

const controlTargetFor = (
  control: RevealSurfaceControl,
): Parameters<typeof targetLocator>[1] => ({
  controlKey: control.controlKey,
  ariaRole: control.ariaRole,
  accessibleName: control.accessibleName,
  enabled: control.enabled,
  href: control.href,
});

/**
 * Wait for the expected semantic controls to become visible after an async
 * query settles. Replay still inventories the page and performs strict
 * surface equality after this bounded, named readiness signal.
 */
export const waitForExpectedRevealSurface = async (input: {
  readonly page: Page;
  readonly expected: RevealSurface;
}): Promise<void> => {
  const supportedControls = input.expected.controls.filter((control) =>
    (SUPPORTED_CONTROL_ROLES as readonly string[]).includes(control.ariaRole),
  );
  await Promise.all(
    supportedControls.map((control) =>
      targetLocator(input.page, controlTargetFor(control)).waitFor({
        state: "visible",
        timeout: REVEAL_DATA_READY_TIMEOUT_MS,
      }),
    ),
  );
};

const nativeOptionAt = async (
  locator: ReturnType<typeof targetLocator>,
  representative: Extract<
    RevealRepresentativeInput,
    { readonly kind: "select" }
  >,
): Promise<void> => {
  const option = locator.locator("option").nth(representative.index);
  const actual = await option.evaluate((element) => {
    if (!(element instanceof HTMLOptionElement))
      throw new TypeError("Reveal select option is not native");
    return { value: element.value, disabled: element.disabled };
  });
  if (actual.value !== representative.value || actual.disabled)
    throw new Error("Native select representative option drifted");
  await locator.selectOption(
    { index: representative.index },
    { timeout: REVEAL_TIMEOUT_MS },
  );
};

const representativeSelectFor = async (
  locator: ReturnType<typeof targetLocator>,
  frozen:
    Extract<RevealRepresentativeInput, { readonly kind: "select" }> | undefined,
): Promise<Extract<RevealRepresentativeInput, { readonly kind: "select" }>> => {
  if (frozen !== undefined) return frozen;
  const options = await locator
    .locator("option:not(:disabled)")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          if (!(element instanceof HTMLOptionElement))
            throw new TypeError("Reveal select option is not native");
          return {
            index: element.index,
            selected: element.selected,
            value: element.value,
          };
        })
        .filter(({ selected, value }) => !selected && value !== ""),
    );
  const option = options.at(0);
  if (option === undefined)
    throw new Error(
      "Native select has no enabled non-empty alternative option for reveal preparation",
    );
  return { kind: "select", value: option.value, index: option.index };
};

const executeFormAction = async (input: {
  readonly page: Page;
  readonly control: Parameters<typeof targetFor>[0];
  readonly representativeInput: RevealRepresentativeInput;
}): Promise<void> => {
  const locator = targetLocator(input.page, targetFor(input.control));
  if (input.representativeInput.kind === "fill") {
    await locator.fill(input.representativeInput.value, {
      timeout: REVEAL_TIMEOUT_MS,
    });
    return;
  }
  await nativeOptionAt(locator, input.representativeInput);
};

const requireRepresentativeInput = (
  value: RevealRepresentativeInput | undefined,
  controlKey: string,
): RevealRepresentativeInput => {
  if (value === undefined)
    throw new Error(
      `Client-only form reveal lacks representative input: ${controlKey}`,
    );
  return value;
};

type RevealActionInput = Parameters<RevealExecutionHarness["executeReveal"]>[0];

const isFormAction = (input: RevealActionInput): boolean =>
  input.action.operation === "fill" || input.action.operation === "select";

const representativeInputForAction = async (
  input: RevealActionInput,
  locator: ReturnType<typeof targetLocator> | undefined,
): Promise<RevealRepresentativeInput | undefined> => {
  if (input.action.operation === "fill")
    return input.representativeInput?.kind === "fill"
      ? input.representativeInput
      : representativeInputForFill(input.control);
  if (input.action.operation !== "select" || locator === undefined)
    return undefined;
  return representativeSelectFor(
    locator,
    input.representativeInput?.kind === "select"
      ? input.representativeInput
      : undefined,
  );
};

const executeRevealAction = async (input: {
  readonly page: Page;
  readonly actionInput: RevealActionInput;
  readonly representativeInput: RevealRepresentativeInput | undefined;
}): Promise<void> => {
  const { action } = input.actionInput;
  if (isFormAction(input.actionInput)) {
    await executeFormAction({
      page: input.page,
      control: input.actionInput.control,
      representativeInput: requireRepresentativeInput(
        input.representativeInput,
        input.actionInput.control.controlKey,
      ),
    });
    return;
  }
  const before = await snapshotPage(input.page);
  const target = targetFor(input.actionInput.control);
  const expectedNavigation = expectedActionNavigationFor(action.controlKey);
  const currentLocation =
    input.actionInput.control.href !== null &&
    new URL(input.actionInput.control.href, before.url).toString() ===
      new URL(before.url).toString();
  const navigationObserver = observeActionNavigation(
    input.page,
    currentLocation ? undefined : expectedNavigation,
  );
  const observedOutcomes: LiveControlObservation[] = [];
  const execution = await executeControlAction({
    page: input.page,
    control: target,
    action,
    observeOutcome: observerFor(
      input.page,
      action.operation,
      before,
      REVEAL_TIMEOUT_MS,
      {
        control: target,
        allowIdempotent: true,
        onObservation: (observation) => {
          observedOutcomes.push(observation);
        },
      },
    ),
    timeoutMs: REVEAL_TIMEOUT_MS,
  });
  if (execution.status !== "pass")
    throw new Error(
      `Reveal action did not reach terminal pass: ${action.controlKey}`,
    );
  await settleRevealActionNavigation({
    action,
    currentLocation,
    expectedNavigation,
    observer: navigationObserver,
    observation: observedOutcomes.at(0),
    page: input.page,
    timing: input.actionInput.timing,
  });
};

export const createPlaywrightRevealExecutor =
  (input: { readonly page: Page }): RevealExecutionHarness["executeReveal"] =>
  async (actionInput): Promise<RevealExecution> => {
    const timed = <Value>(
      stage: Parameters<NonNullable<typeof actionInput.timing>["span"]>[0],
      operation: () => Promise<Value>,
    ): Promise<Value> =>
      actionInput.timing?.span(stage, operation) ?? operation();
    const locator = isFormAction(actionInput)
      ? targetLocator(input.page, targetFor(actionInput.control))
      : undefined;
    const representativeInput = await timed("representativeInput", () =>
      representativeInputForAction(actionInput, locator),
    );
    if (actionInput.preparation === undefined)
      throw new Error(
        "Playwright reveal execution lacks prepared DB proof context",
      );
    const nonMutation = await actionInput.preparation.proveNonMutation(
      () =>
        executeRevealAction({
          page: input.page,
          actionInput,
          representativeInput,
        }),
      actionInput.timing,
    );
    const observation = await timed("postObservation", () =>
      captureRevealExecutionObservation({
        inventory: () => inventoryDom(input.page),
        page: input.page,
      }),
    );
    return {
      ...observation,
      nonMutation,
      ...(representativeInput === undefined ? {} : { representativeInput }),
    };
  };

export const createPlaywrightRevealRepresentativeInputFreezer =
  (input: {
    readonly page: Page;
  }): NonNullable<RevealExecutionHarness["freezeRepresentativeInput"]> =>
  async (candidateInput) => {
    if (candidateInput.action.operation !== "select")
      return candidateInput.representativeInput;
    const locator = targetLocator(
      input.page,
      targetFor(candidateInput.control),
    );
    return representativeSelectFor(
      locator,
      candidateInput.representativeInput?.kind === "select"
        ? candidateInput.representativeInput
        : undefined,
    );
  };
