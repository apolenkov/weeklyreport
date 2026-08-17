import type { Action } from "../../source/contracts.ts";

const INTERACTIVE_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "gridcell",
  "link",
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
const STATE_CHANGING_ROLE =
  /^(?:checkbox|radio|switch|menuitemcheckbox|menuitemradio|slider|option)$/u;
const FORM_FILL_ROLES = new Set(["searchbox", "spinbutton", "textbox"]);
const FORM_SELECT_ROLES = new Set(["combobox", "listbox"]);
const DIRECT_MUTATION_BUTTON_NAMES = new Set([
  "at risk",
  "blocked",
  "mark complete",
  "move this report to the archive",
  "move to current week",
  "move to next week",
  "on track",
]);
const DIRECT_MUTATION_BUTTON_PREFIX =
  /^(?:(?:acknowledge|activate|deactivate|downgrade risk|escalate risk|request reopen)\b|(?:archive|reopen|unarchive)\s+\S)/u;
const STAGE_STATUS_BUTTON_NAME =
  /^[^:]+: (?:empty|on-track|at-risk|blocked)(?: (?:by risk|— status set))?$/u;

export type StatefulOperation = "publish" | "delete" | "revoke" | "restore";

export const normalizedControlName = (name: string): string =>
  name.trim().replaceAll(/\s+/g, " ").toLocaleLowerCase();

export const isInteractiveRole = (role: string): boolean =>
  INTERACTIVE_ROLES.has(role);

export const isStateChangingRole = (role: string): boolean =>
  STATE_CHANGING_ROLE.test(role);

export const isFormFillRole = (role: string): boolean =>
  FORM_FILL_ROLES.has(role);

export const isFormSelectRole = (role: string): boolean =>
  FORM_SELECT_ROLES.has(role);

export const transitionForName = (
  name: string,
): Extract<Action["transition"], "open" | "cancel"> | undefined => {
  const normalized = normalizedControlName(name);
  if (/^(?:open|show|view|expand|edit|details)\b/u.test(normalized))
    return "open";
  if (/^(?:cancel|close|dismiss)\b/u.test(normalized)) return "cancel";
  return undefined;
};

export const statefulOperationFor = (
  name: string,
): StatefulOperation | undefined => {
  const normalized = normalizedControlName(name);
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

export const isDirectMutationName = (name: string): boolean => {
  const normalized = normalizedControlName(name);
  return (
    DIRECT_MUTATION_BUTTON_NAMES.has(normalized) ||
    DIRECT_MUTATION_BUTTON_PREFIX.test(normalized) ||
    STAGE_STATUS_BUTTON_NAME.test(normalized)
  );
};
