import {
  type Action,
  type ActionOperation,
  type ActionSafety,
} from "../../source/contracts.ts";
import { assertDisposableE2eDatabase } from "../recovery/control-recovery.ts";
import {
  FORM_FILL_ROLES,
  FORM_SELECT_ROLES,
  SUPPORTED_CONTROL_ROLES,
  type SupportedControlRole,
} from "./control-action-roles.ts";
import type {
  ControlActionExecution,
  ControlActionInput,
} from "./control-action-types.ts";

export const STATEFUL_CONTROL_OPERATIONS = [
  "publish",
  "delete",
  "revoke",
  "restore",
  "submit",
] as const;
export type StatefulControlOperation =
  (typeof STATEFUL_CONTROL_OPERATIONS)[number];
export const POTENTIALLY_MUTATING_FORM_OPERATIONS = [
  "fill",
  "select",
  "submit",
] as const;

const REQUIRED_SAFETY: Readonly<
  Record<StatefulControlOperation, ActionSafety>
> = {
  publish: "irreversible",
  delete: "irreversible",
  revoke: "irreversible",
  restore: "reversible",
  submit: "irreversible",
};
const RECOVERY_SAFETY: Readonly<
  Partial<Record<ActionOperation, ActionSafety>>
> = {
  ...REQUIRED_SAFETY,
  retry: "reversible",
  fill: "irreversible",
  select: "irreversible",
  submit: "irreversible",
};
const isStateful = (
  operation: ActionOperation,
): operation is StatefulControlOperation =>
  (STATEFUL_CONTROL_OPERATIONS as readonly string[]).includes(operation);

export const isRecoveryBackedAction = (action: Action): boolean => {
  if (action.operation === "click") return action.safety !== "read-only";
  const requiredSafety = RECOVERY_SAFETY[action.operation];
  if (requiredSafety === undefined || action.safety !== requiredSafety)
    return false;
  return ["fill", "select"].includes(action.operation)
    ? true
    : action.transition === action.operation;
};

export const requiresControlRecovery = (input: ControlActionInput): boolean =>
  isRecoveryBackedAction(input.action);

const isSupportedRole = (role: string): role is SupportedControlRole =>
  (SUPPORTED_CONTROL_ROLES as readonly string[]).includes(role);

const isFormFillRole = (role: string): boolean =>
  (FORM_FILL_ROLES as readonly string[]).includes(role);

const isFormSelectRole = (role: string): boolean =>
  (FORM_SELECT_ROLES as readonly string[]).includes(role);

const isNativeSelect = (input: ControlActionInput): boolean =>
  input.control.tagName?.trim().toLocaleLowerCase() === "select" &&
  isFormSelectRole(input.control.ariaRole);

const isSearchInput = (input: ControlActionInput): boolean =>
  input.control.tagName?.trim().toLocaleLowerCase() === "input" &&
  input.control.inputType?.trim().toLocaleLowerCase() === "search";

const messageFrom = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown control-action failure";

const unsupported = (
  input: ControlActionInput,
  policy: "inapplicable" | "unsafe" | "unavailable",
  reason: string,
): ControlActionExecution => ({
  status: "not-exercised",
  controlKey: input.control.controlKey,
  operation: input.action.operation,
  resetPerformed: false,
  policy,
  reason,
});

const validateRecovery = (
  input: ControlActionInput,
  reason: string,
): ControlActionExecution | undefined => {
  if (input.recovery === undefined) return unsupported(input, "unsafe", reason);
  try {
    assertDisposableE2eDatabase(input.recovery.databaseUrl);
    return undefined;
  } catch (error: unknown) {
    return unsupported(input, "unsafe", messageFrom(error));
  }
};

const validateStatefulPolicy = (
  input: ControlActionInput,
  operation: StatefulControlOperation,
): ControlActionExecution | undefined => {
  const { action } = input;
  const requiredSafety = REQUIRED_SAFETY[operation];
  if (action.safety !== requiredSafety)
    return unsupported(
      input,
      "unsafe",
      `${action.operation} requires ${requiredSafety} safety`,
    );
  if (action.transition !== action.operation)
    return unsupported(
      input,
      "unsafe",
      `${action.operation} requires a matching ${action.operation} transition`,
    );
  return validateRecovery(
    input,
    `${action.operation} requires a disposable E2E recovery`,
  );
};

const validateFormMutationPolicy = (
  input: ControlActionInput,
): ControlActionExecution | undefined => {
  if (input.action.safety !== "irreversible")
    return unsupported(
      input,
      "unsafe",
      `${input.action.operation} may mutate or autosave and requires disposable-reset safety`,
    );
  return validateRecovery(
    input,
    `${input.action.operation} may mutate or autosave and requires a disposable E2E recovery`,
  );
};

const validateRetryPolicy = (
  input: ControlActionInput,
): ControlActionExecution | undefined => {
  if (input.action.safety !== "reversible")
    return unsupported(input, "unsafe", "retry requires reversible safety");
  if (input.action.transition !== "retry")
    return unsupported(
      input,
      "unsafe",
      "retry requires a matching retry transition",
    );
  return validateRecovery(input, "retry requires a disposable E2E recovery");
};

const validateFormOperation = (
  input: ControlActionInput,
  operation: "fill" | "select",
): ControlActionExecution | undefined => {
  const supported =
    operation === "fill"
      ? isFormFillRole(input.control.ariaRole) || isSearchInput(input)
      : isNativeSelect(input);
  return supported
    ? validateFormMutationPolicy(input)
    : unsupported(
        input,
        "inapplicable",
        `Operation ${operation} is not bounded for role ${input.control.ariaRole}`,
      );
};

const validateOperation = (
  input: ControlActionInput,
): ControlActionExecution | undefined => {
  const { action, control } = input;
  if (isStateful(action.operation))
    return validateStatefulPolicy(input, action.operation);
  if (action.operation === "retry") return validateRetryPolicy(input);
  if (action.operation === "click")
    return action.safety === "read-only"
      ? undefined
      : validateRecovery(
          input,
          "click may mutate or autosave and requires a disposable E2E recovery",
        );
  if (action.operation === "fill" || action.operation === "select")
    return validateFormOperation(input, action.operation);
  return unsupported(
    input,
    "inapplicable",
    `Operation ${action.operation} is not bounded for role ${control.ariaRole}`,
  );
};

export function validateControlActionPolicy(
  input: ControlActionInput,
): ControlActionExecution | undefined {
  if (input.control.accessibleName.trim() === "")
    return unsupported(input, "unavailable", "Control has no accessible name");
  if (!input.control.enabled)
    return unsupported(input, "unavailable", "Control is disabled");
  if (!isSupportedRole(input.control.ariaRole))
    return unsupported(
      input,
      "inapplicable",
      `Unsupported role ${input.control.ariaRole}`,
    );
  return validateOperation(input);
}
