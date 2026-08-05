import type { Action } from "../source/contracts.ts";
import type { ControlActionExecution } from "./control-actions.ts";
import type { DomControlObservation } from "./dom-inventory.ts";

const INTERACTIVE_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "gridcell",
  "link",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "scrollbar",
  "slider",
  "switch",
  "tab",
  "treeitem",
]);
const FORM_FILL_ROLES = new Set(["searchbox", "spinbutton", "textbox"]);
const FORM_SELECT_ROLES = new Set(["combobox", "listbox"]);
type NotExercisedPolicy = "inapplicable" | "unsafe" | "unavailable";
type FormSafety = "non-mutating" | "disposable-reset";
type StatefulOperation = "publish" | "delete" | "revoke" | "restore";

export interface LiveControlPlanningOptions {
  readonly formSafety?: FormSafety;
}

export interface LiveControlPlan {
  readonly control: DomControlObservation;
  readonly action?: Action;
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

const normalizedName = (name: string): string =>
  name.trim().replaceAll(/\s+/g, " ").toLocaleLowerCase();

const normalizedTagName = (control: DomControlObservation): string =>
  control.tagName.trim().toLocaleLowerCase();

const normalizedInputType = (control: DomControlObservation): string =>
  (control.inputType ?? "").trim().toLocaleLowerCase();

const isSearchInput = (control: DomControlObservation): boolean =>
  normalizedTagName(control) === "input" &&
  normalizedInputType(control) === "search";

const isNativeSelect = (control: DomControlObservation): boolean =>
  normalizedTagName(control) === "select" &&
  FORM_SELECT_ROLES.has(control.role);

const isFormFillControl = (control: DomControlObservation): boolean =>
  FORM_FILL_ROLES.has(control.role) || isSearchInput(control);

const isFormSelectControl = (control: DomControlObservation): boolean =>
  isNativeSelect(control);

const isSubmitControl = (control: DomControlObservation): boolean =>
  control.role === "button" &&
  (control.inputType === "submit" ||
    ["create", "request", "save", "send", "submit"].some((prefix) => {
      const name = normalizedName(control.accessibleName);
      return name === prefix || name.startsWith(`${prefix} `);
    }));

const transitionForName = (
  name: string,
): Extract<Action["transition"], "open" | "cancel"> | undefined => {
  const normalized = normalizedName(name);
  if (/^(?:open|show|view|expand|edit|details)\b/u.test(normalized))
    return "open";
  if (/^(?:cancel|close|dismiss)\b/u.test(normalized)) return "cancel";
  return undefined;
};

const statefulOperationFor = (name: string): StatefulOperation | undefined => {
  const normalized = normalizedName(name);
  if (normalized === "publish" || normalized.startsWith("publish "))
    return "publish";
  if (normalized === "delete" || normalized.startsWith("delete "))
    return "delete";
  if (normalized === "revoke" || normalized.startsWith("revoke "))
    return "revoke";
  if (normalized === "restore" || normalized.startsWith("restore "))
    return "restore";
  return undefined;
};

const unsupportedPlan = (
  control: DomControlObservation,
  policy: NotExercisedPolicy,
  reason: string,
): LiveControlPlan => ({ control, policy, reason });

const clickAction = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
});

const interactiveAction = (control: DomControlObservation): Action => {
  const normalized = normalizedName(control.accessibleName);
  if (/^(?:retry|try again)\b/u.test(normalized))
    return retryAction(control.controlKey);
  const transition = transitionForName(control.accessibleName);
  return transition === undefined
    ? clickAction(control.controlKey)
    : { ...clickAction(control.controlKey), transition };
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
  if (control.accessibleName.trim() === "")
    return unsupportedPlan(
      control,
      "unavailable",
      "Control has no accessible name",
    );
  if (!control.enabled)
    return unsupportedPlan(control, "unavailable", "Control is disabled");
  const stateful = statefulOperationFor(control.accessibleName);
  if (stateful !== undefined)
    return { control, action: statefulAction(stateful, control.controlKey) };
  if (
    isFormFillControl(control) ||
    isFormSelectControl(control) ||
    isSubmitControl(control)
  )
    return formPlan(control, options);
  if (INTERACTIVE_ROLES.has(control.role))
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
