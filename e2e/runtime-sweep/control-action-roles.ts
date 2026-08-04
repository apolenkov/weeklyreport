export type SupportedControlRole =
  | "alertdialog"
  | "button"
  | "checkbox"
  | "combobox"
  | "gridcell"
  | "link"
  | "listbox"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "option"
  | "radio"
  | "searchbox"
  | "scrollbar"
  | "slider"
  | "spinbutton"
  | "switch"
  | "tab"
  | "treeitem"
  | "textbox";

export const SUPPORTED_CONTROL_ROLES: readonly SupportedControlRole[] = [
  "alertdialog",
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
  "searchbox",
  "scrollbar",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "treeitem",
  "textbox",
];

export const FORM_FILL_ROLES: readonly SupportedControlRole[] = [
  "searchbox",
  "spinbutton",
  "textbox",
];

export const FORM_SELECT_ROLES: readonly SupportedControlRole[] = [
  "combobox",
  "listbox",
];
