import type { Page } from "@playwright/test";

import { stableSerialize } from "../../support/ids.ts";
import type {
  ControlActionExecution,
  ControlActionTarget,
} from "../control-actions/control-actions.ts";
import type { DomControlObservation } from "../dom/dom-inventory.ts";
import {
  controlAlreadyActive,
  controlCountDecreased,
  observationFor,
  type PageSnapshot,
  snapshotPage,
  waitForObservation,
} from "./live-control-observation.ts";
import type {
  LiveControlActionRecord,
  LiveControlObservation,
  LiveControlPlan,
} from "./live-control-planning.ts";

const STATEFUL_SUCCESS: Readonly<Record<StatefulOperation, RegExp>> = {
  publish: /period published|published\s*&\s*locked|published successfully/i,
  delete: /deleted|removed|successfully/i,
  revoke: /submission revoked|revoked|returned to draft|draft status/i,
  restore: /restored|unarchived/i,
  submit: /report submitted|✓ submitted/i,
};
const MAX_OBSERVATION_WAIT_MS = 2000;
type StatefulOperation = "publish" | "delete" | "revoke" | "restore" | "submit";

const nextAnimationFrame = async (page: Page): Promise<void> => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
};

const stateful = (operation: string): operation is StatefulOperation =>
  operation === "publish" ||
  operation === "delete" ||
  operation === "revoke" ||
  operation === "restore" ||
  operation === "submit";

const textOutcomeObserver =
  (
    page: Page,
    operation: StatefulOperation,
    timeoutMs: number,
  ): (() => Promise<"pass">) =>
  async () => {
    await page
      .getByText(STATEFUL_SUCCESS[operation], { exact: false })
      .last()
      .waitFor({ state: "visible", timeout: timeoutMs });
    return "pass";
  };

const deleteOutcomeObserver =
  (
    page: Page,
    before: PageSnapshot,
    control: ControlActionTarget,
    timeoutMs: number,
  ): (() => Promise<"pass">) =>
  async () => {
    const deadline = Date.now() + Math.min(timeoutMs, MAX_OBSERVATION_WAIT_MS);
    while (Date.now() < deadline) {
      await nextAnimationFrame(page);
      if (controlCountDecreased(before, await snapshotPage(page), control))
        return "pass";
    }
    throw new Error("Delete target count did not decrease after confirmation");
  };

export const targetFor = (
  control: DomControlObservation,
): ControlActionTarget => ({
  controlKey: control.controlKey,
  ariaRole: control.role,
  accessibleName: control.accessibleName,
  enabled: control.enabled,
  inputType: control.inputType,
  tagName: control.tagName,
  href: control.href,
});

export const recordFor = (
  plan: LiveControlPlan,
  execution: ControlActionExecution,
  observation?: LiveControlObservation,
): LiveControlActionRecord => ({
  controlKey: plan.control.controlKey,
  ariaRole: plan.control.role,
  accessibleName: plan.control.accessibleName,
  enabled: plan.control.enabled,
  order: plan.control.order,
  ...(plan.action === undefined ? {} : { action: plan.action }),
  status: execution.status,
  resetPerformed: execution.resetPerformed,
  ...(observation === undefined ? {} : { observation }),
  ...(execution.status === "not-exercised"
    ? { policy: execution.policy, reason: execution.reason }
    : execution.reason === undefined
      ? {}
      : { reason: execution.reason }),
});

export const notExercisedRecord = (
  plan: LiveControlPlan,
  fallbackReason = "No bounded live action was declared",
): LiveControlActionRecord => ({
  controlKey: plan.control.controlKey,
  ariaRole: plan.control.role,
  accessibleName: plan.control.accessibleName,
  enabled: plan.control.enabled,
  order: plan.control.order,
  status: "not-exercised",
  resetPerformed: false,
  policy: plan.policy ?? "inapplicable",
  reason: plan.reason ?? fallbackReason,
});

export const actionFailureRecord = (
  plan: LiveControlPlan,
  reason: string,
): LiveControlActionRecord =>
  recordFor(plan, {
    status: "fail",
    controlKey: plan.control.controlKey,
    operation: plan.action?.operation ?? "click",
    resetPerformed: false,
    reason,
  });

export const observerFor = (
  page: Page,
  operation: string,
  before: PageSnapshot,
  timeoutMs: number,
  options: Readonly<{
    readonly control?: ControlActionTarget;
    readonly allowIdempotent?: boolean;
    readonly requireMeaningfulFocus?: boolean;
  }> = {},
): (() => Promise<"pass" | "fail">) => {
  if (operation === "delete" && options.control !== undefined)
    return deleteOutcomeObserver(page, before, options.control, timeoutMs);
  if (stateful(operation))
    return textOutcomeObserver(page, operation, timeoutMs);
  return async (): Promise<"pass" | "fail"> => {
    const alreadyActive =
      options.allowIdempotent === true &&
      options.control !== undefined &&
      controlAlreadyActive(before, options.control);
    if (alreadyActive) return "pass";
    const observed = await waitForObservation(
      page,
      before,
      Math.min(timeoutMs, MAX_OBSERVATION_WAIT_MS),
      options.requireMeaningfulFocus === true
        ? { requireMeaningfulFocus: true }
        : {},
    );
    return observed === undefined ? "fail" : "pass";
  };
};

export const observationAfter = async (
  page: Page,
  operation: string,
  before: PageSnapshot,
  status: ControlActionExecution["status"],
  options: Readonly<{
    readonly control?: ControlActionTarget;
    readonly allowIdempotent?: boolean;
    readonly requireMeaningfulFocus?: boolean;
  }> = {},
): Promise<LiveControlObservation | undefined> => {
  if (stateful(operation))
    return {
      kind: "dom",
      detail:
        status === "pass"
          ? "Stateful success oracle observed"
          : "Stateful action had no bounded success oracle",
    };
  const observed = observationFor(
    before,
    await snapshotPage(page),
    options.requireMeaningfulFocus === true
      ? { requireMeaningfulFocus: true }
      : {},
  );
  return (
    observed ??
    (status === "pass" &&
    options.allowIdempotent === true &&
    options.control !== undefined &&
    controlAlreadyActive(before, options.control)
      ? { kind: "dom", detail: "Control was already active" }
      : undefined) ??
    (status === "fail"
      ? { kind: "dom", detail: "No observable outcome was produced" }
      : undefined)
  );
};

export const planSignature = (plan: LiveControlPlan): string =>
  `${plan.control.enabled}:${plan.control.accessibleName}:${plan.action?.operation ?? "none"}:${plan.action?.safety ?? "none"}:${plan.action?.transition ?? "none"}:${stableSerialize(plan.representativeInput ?? null)}`;
