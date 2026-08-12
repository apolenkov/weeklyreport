import type { Page } from "@playwright/test";

import {
  expectedActionNavigationFor,
  observeActionNavigation,
  settleActionNavigation,
} from "../../replay/control-actions/action-navigation-boundary.ts";
import { executeControlAction } from "../../replay/control-actions/control-actions.ts";
import { targetLocator } from "../../replay/control-target/rendered-control-target.ts";
import { inventoryDom } from "../../replay/dom/dom-inventory.ts";
import { snapshotPage } from "../../replay/live-control/live-control-observation.ts";
import {
  observerFor,
  targetFor,
} from "../../replay/live-control/live-control-records.ts";
import {
  representativeInputForFill,
  type RevealRepresentativeInput,
} from "../reveal/interaction/preflight-reveal-transition.ts";
import type {
  RevealExecution,
  RevealExecutionHarness,
} from "../reveal/interaction/preflight-reveal-types.ts";

const REVEAL_TIMEOUT_MS = 10_000;

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
  const expectedNavigation = expectedActionNavigationFor(
    input.actionInput.action.controlKey,
  );
  const currentLocation =
    input.actionInput.control.href !== null &&
    new URL(input.actionInput.control.href, before.url).toString() ===
      new URL(before.url).toString();
  const navigationExpectation = currentLocation
    ? undefined
    : expectedNavigation;
  const navigationObserver = observeActionNavigation(
    input.page,
    navigationExpectation,
  );
  const execution = await executeControlAction({
    page: input.page,
    control: target,
    action: input.actionInput.action,
    observeOutcome: observerFor(
      input.page,
      input.actionInput.action.operation,
      before,
      REVEAL_TIMEOUT_MS,
      { control: target, allowIdempotent: true },
    ),
    timeoutMs: REVEAL_TIMEOUT_MS,
  });
  if (execution.status !== "pass")
    throw new Error(
      `Reveal action did not reach terminal pass: ${input.actionInput.action.controlKey}`,
    );
  if (currentLocation) {
    navigationObserver.cancel();
    return;
  }
  if (
    navigationExpectation !== undefined ||
    input.page.url() !== navigationObserver.initialUrl
  ) {
    const navigation = await settleActionNavigation(
      input.page,
      navigationObserver,
      undefined,
      navigationExpectation,
    );
    if (navigation.status === "failed")
      throw new Error(`Reveal action navigation failed: ${navigation.reason}`);
    return;
  }
  navigationObserver.cancel();
};

export const createPlaywrightRevealExecutor =
  (input: { readonly page: Page }): RevealExecutionHarness["executeReveal"] =>
  async (actionInput): Promise<RevealExecution> => {
    const locator = isFormAction(actionInput)
      ? targetLocator(input.page, targetFor(actionInput.control))
      : undefined;
    const representativeInput = await representativeInputForAction(
      actionInput,
      locator,
    );
    if (actionInput.preparation === undefined)
      throw new Error(
        "Playwright reveal execution lacks prepared DB proof context",
      );
    const nonMutation = await actionInput.preparation.proveNonMutation(() =>
      executeRevealAction({
        page: input.page,
        actionInput,
        representativeInput,
      }),
    );
    return {
      url: input.page.url(),
      inventory: await inventoryDom(input.page),
      nonMutation,
      ...(representativeInput === undefined ? {} : { representativeInput }),
    };
  };
