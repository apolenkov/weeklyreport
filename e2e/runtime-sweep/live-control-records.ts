import type { Page } from "@playwright/test";

import type {
  ControlActionExecution,
  ControlActionTarget,
} from "./control-actions.ts";
import type { DomControlObservation } from "./dom-inventory.ts";
import {
  observationFor,
  type PageSnapshot,
  snapshotPage,
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
};
export type StatefulOperation = "publish" | "delete" | "revoke" | "restore";

const stateful = (operation: string): operation is StatefulOperation =>
  operation === "publish" ||
  operation === "delete" ||
  operation === "revoke" ||
  operation === "restore";

const outcomeObserver =
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
): (() => Promise<"pass" | "fail">) =>
  stateful(operation)
    ? outcomeObserver(page, operation, timeoutMs)
    : async (): Promise<"pass" | "fail"> => {
        const after = await snapshotPage(page);
        return observationFor(before, after) === undefined ? "fail" : "pass";
      };

export const observationAfter = async (
  page: Page,
  operation: string,
  before: PageSnapshot,
  status: ControlActionExecution["status"],
): Promise<LiveControlObservation | undefined> => {
  if (stateful(operation))
    return {
      kind: "dom",
      detail:
        status === "pass"
          ? "Stateful success oracle observed"
          : "Stateful action had no bounded success oracle",
    };
  const observed = observationFor(before, await snapshotPage(page));
  return (
    observed ??
    (status === "fail"
      ? { kind: "dom", detail: "No observable outcome was produced" }
      : undefined)
  );
};

export const planSignature = (plan: LiveControlPlan): string =>
  `${plan.control.enabled}:${plan.control.accessibleName}:${plan.action?.operation ?? "none"}:${plan.action?.safety ?? "none"}:${plan.action?.transition ?? "none"}`;
