import type { RevealRepresentativeInput } from "../../matrix/reveal-transition.ts";
import type { Action } from "../../source/contracts.ts";
import type { ControlActionExecution } from "../control-actions/control-actions.ts";
import type { DomControlObservation } from "../dom/dom-inventory.ts";
import {
  isDirectMutationName,
  isFormFillRole,
  isFormSelectRole,
  isInteractiveRole,
  isStateChangingRole,
  normalizedControlName,
  type StatefulOperation,
  statefulOperationFor,
  transitionForName,
} from "./live-control-planning-policy.ts";

type NotExercisedPolicy = "inapplicable" | "unsafe" | "unavailable";
type FormSafety = "non-mutating" | "disposable-reset";

export interface LiveControlPlanningOptions {
  readonly formSafety?: FormSafety;
}

export interface LiveControlPlan {
  readonly control: DomControlObservation;
  readonly action?: Action;
  readonly representativeInput?: RevealRepresentativeInput;
  readonly policy?: NotExercisedPolicy;
  readonly reason?: string;
}

export interface LiveControlObservation {
  readonly kind: "url" | "dom" | "focus" | "network";
  readonly detail: string;
}

export interface LiveControlActionRecord {
  readonly controlKey: string;
  readonly ariaRole: string;
  readonly accessibleName: string;
  readonly enabled: boolean;
  readonly order: number;
  readonly action?: Action;
  readonly status: ControlActionExecution["status"];
  readonly resetPerformed: boolean;
  readonly observation?: LiveControlObservation;
  readonly policy?: NotExercisedPolicy;
  readonly reason?: string;
}

const statefulAction = (
  operation: StatefulOperation,
  controlKey: string,
): Action => ({
  controlKey,
  operation,
  safety: operation === "restore" ? "reversible" : "irreversible",
  transition: operation,
});

const retryAction = (controlKey: string): Action => ({
  controlKey,
  operation: "retry",
  safety: "reversible",
  transition: "retry",
});

const normalizedTagName = (control: DomControlObservation): string =>
  control.tagName.trim().toLocaleLowerCase();

const normalizedInputType = (control: DomControlObservation): string =>
  (control.inputType ?? "").trim().toLocaleLowerCase();

const isSearchInput = (control: DomControlObservation): boolean =>
  normalizedTagName(control) === "input" &&
  normalizedInputType(control) === "search";

const isFormFillControl = (control: DomControlObservation): boolean =>
  isFormFillRole(control.role) || isSearchInput(control);

const isFormSelectControl = (control: DomControlObservation): boolean =>
  normalizedTagName(control) === "select" && isFormSelectRole(control.role);

const isSubmitControl = (control: DomControlObservation): boolean =>
  control.role === "button" &&
  (control.inputType === "submit" ||
    ["create", "request", "save", "send", "submit"].some((prefix) => {
      const name = normalizedControlName(control.accessibleName);
      return name === prefix || name.startsWith(`${prefix} `);
    }));

const asyncSideEffectReason = (
  control: DomControlObservation,
): string | null =>
  normalizedControlName(control.accessibleName) === "export pdf"
    ? "Async PDF export requires a dedicated job-completion and queue-cleanup oracle"
    : null;

const unsupportedPlan = (
  control: DomControlObservation,
  policy: NotExercisedPolicy,
  reason: string,
): LiveControlPlan => ({ control, policy, reason });

const clickAction = (
  controlKey: string,
  safety: Action["safety"] = "read-only",
): Action => ({
  controlKey,
  operation: "click",
  safety,
  transition: "none",
});

const bindStableTarget = (
  control: DomControlObservation,
  action: Action,
): Action =>
  control.role === "link" && control.href !== null && control.href !== ""
    ? { ...action, target: { role: "link", href: control.href } }
    : action;

const isDirectMutationButton = (control: DomControlObservation): boolean =>
  control.role === "button" && isDirectMutationName(control.accessibleName);

const interactiveAction = (control: DomControlObservation): Action => {
  const normalized = normalizedControlName(control.accessibleName);
  if (/^(?:retry|try again)\b/u.test(normalized))
    return retryAction(control.controlKey);
  const safety = isDirectMutationButton(control) ? "irreversible" : "read-only";
  const transition = transitionForName(control.accessibleName);
  const action =
    transition === undefined
      ? clickAction(control.controlKey, safety)
      : { ...clickAction(control.controlKey, safety), transition };
  return bindStableTarget(control, action);
};

const formAction = (
  control: DomControlObservation,
  operation: "fill" | "select" | "submit",
  safety: "read-only" | "irreversible",
): Action => ({
  controlKey: control.controlKey,
  operation,
  safety,
  transition: operation === "submit" ? "submit" : "none",
});

const formPlan = (
  control: DomControlObservation,
  options: LiveControlPlanningOptions,
): LiveControlPlan => {
  const safety = options.formSafety;
  if (safety === undefined)
    return unsupportedPlan(
      control,
      "unsafe",
      "Form control requires a non-mutating or disposable reset oracle",
    );
  if (safety === "non-mutating")
    return unsupportedPlan(
      control,
      "unsafe",
      "Potentially mutating form controls are not exercised without disposable-reset recovery",
    );
  if (isFormFillControl(control))
    return { control, action: formAction(control, "fill", "irreversible") };
  if (isFormSelectControl(control))
    return {
      control,
      action: formAction(control, "select", "irreversible"),
    };
  if (isSubmitControl(control))
    return {
      control,
      action: formAction(control, "submit", "irreversible"),
    };
  return unsupportedPlan(
    control,
    "inapplicable",
    `Role ${control.role} is not a bounded form control`,
  );
};

const planFor = (
  control: DomControlObservation,
  options: LiveControlPlanningOptions,
): LiveControlPlan => {
  if (control.keyboardFocusScope === "background")
    return unsupportedPlan(
      control,
      "unavailable",
      "Control is blocked by an active modal",
    );
  if (control.accessibleName.trim() === "")
    return unsupportedPlan(
      control,
      "unavailable",
      "Control has no accessible name",
    );
  if (!control.enabled)
    return unsupportedPlan(control, "unavailable", "Control is disabled");
  if (isStateChangingRole(control.role))
    return {
      control,
      action: clickAction(control.controlKey, "irreversible"),
    };
  const sideEffectReason = asyncSideEffectReason(control);
  if (sideEffectReason !== null)
    return unsupportedPlan(control, "unsafe", sideEffectReason);
  const stateful = statefulOperationFor(control.accessibleName);
  if (stateful !== undefined)
    return { control, action: statefulAction(stateful, control.controlKey) };
  if (isDirectMutationButton(control))
    return { control, action: interactiveAction(control) };
  if (
    isFormFillControl(control) ||
    isFormSelectControl(control) ||
    isSubmitControl(control)
  )
    return formPlan(control, options);
  if (isInteractiveRole(control.role))
    return { control, action: interactiveAction(control) };
  return unsupportedPlan(
    control,
    "inapplicable",
    `Role ${control.role} is a control-bearing landmark without a direct action`,
  );
};

export function planLiveControlActions(
  controls: readonly DomControlObservation[],
  options: LiveControlPlanningOptions = {},
): readonly LiveControlPlan[] {
  return controls.map((control) => planFor(control, options));
}
