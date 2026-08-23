export type KeyboardFocusScope = "page" | "active-modal" | "background";

export type KeyboardFocusPolicy = "required" | "forbidden" | "unreachable";

export const KEYBOARD_FOCUS_POLICY_SCRIPT = `
  const nonTabRoles = new Set(["alertdialog","dialog","menu","option","tabpanel"]);
  const activeModals = candidates.filter(({ element, role }) =>
    (role === "dialog" || role === "alertdialog") &&
    element.getAttribute("aria-modal")?.toLowerCase() === "true");
  const activeModal = activeModals.find(({ element }) => element.contains(document.activeElement))?.element
    || activeModals.at(-1)?.element
    || null;
  const scopeFor = (element) => activeModal === null
    ? "page"
    : activeModal.contains(element) ? "active-modal" : "background";
  const nativeRadioFor = (element) =>
    element instanceof HTMLInputElement && element.type.toLowerCase() === "radio";
  const groupKeyFor = (entry, index) => {
    if (entry.role !== "radio") return null;
    if (nativeRadioFor(entry.element)) {
      const name = entry.element.getAttribute("name")?.trim();
      if (!name) return "native:standalone:" + index;
      const formIndex = entry.element.form === null
        ? "document"
        : String(formElements.indexOf(entry.element.form));
      return "native:" + formIndex + ":" + name;
    }
    const group = entry.element.closest('[role="radiogroup"]');
    return group === null
      ? "aria:standalone:" + index
      : "aria:" + radioGroups.indexOf(group);
  };
  const entries = candidates.map((entry, index) => ({
    ...entry,
    focusScope: scopeFor(entry.element),
    radioGroupKey: groupKeyFor(entry, index),
    nativeRadio: nativeRadioFor(entry.element),
  }));
  const scopeAllowsTab = (entry) => activeModal === null || entry.focusScope === "active-modal";
  const tabGroupsByKey = new Map();
  entries.filter(({ role }) => role === "tab").forEach((entry, index) => {
    const tabList = entry.element.closest('[role="tablist"]');
    const key = tabList || "standalone-tab:" + index;
    const members = tabGroupsByKey.get(key) || [];
    tabGroupsByKey.set(key, [...members, entry]);
  });
  const tabStops = new Set();
  tabGroupsByKey.forEach((members) => {
    const tabStop = members.find((entry) =>
      scopeAllowsTab(entry) && !entry.disabled && !entry.inert &&
      (entry.tabIndex === 0 || entry.selected));
    if (tabStop !== undefined) tabStops.add(tabStop.element);
  });
  const radioGroupsByKey = new Map();
  entries.filter(({ radioGroupKey }) => radioGroupKey !== null).forEach((entry) => {
    const members = radioGroupsByKey.get(entry.radioGroupKey) || [];
    radioGroupsByKey.set(entry.radioGroupKey, [...members, entry]);
  });
  const radioTabStops = new Set();
  radioGroupsByKey.forEach((members) => {
    const candidatesForGroup = members.filter((entry) =>
      scopeAllowsTab(entry) && !entry.disabled && !entry.inert);
    if (candidatesForGroup.length === 0) return;
    const roving = members.some((entry) => !entry.nativeRadio && entry.explicitTabIndex);
    const tabEligible = candidatesForGroup.filter((entry) => entry.tabIndex >= 0);
    const tabStop = roving
      ? tabEligible.find((entry) => entry.tabIndex === 0) || tabEligible[0] || candidatesForGroup[0]
      : tabEligible.find((entry) => entry.checked) || tabEligible[0] || candidatesForGroup[0];
    radioTabStops.add(tabStop.element);
  });
  const focusPolicyFor = (entry) => {
    if (entry.disabled || entry.inert || nonTabRoles.has(entry.role) ||
      (entry.role === "listbox" && entry.tabIndex < 0)) return "unreachable";
    if (!scopeAllowsTab(entry)) return "forbidden";
    if (entry.role === "tab") return tabStops.has(entry.element) ? "required" : "unreachable";
    if (entry.role !== "radio" || radioTabStops.has(entry.element)) return "required";
    return !entry.nativeRadio && entry.tabIndex >= 0 ? "forbidden" : "unreachable";
  };
  return entries.map((entry) => {
    const keyboardFocusPolicy = focusPolicyFor(entry);
    return { role: entry.role, tagName: entry.tagName, inputType: entry.inputType,
      href: entry.href, ariaControls: entry.ariaControls,
      ariaExpanded: entry.ariaExpanded,
      disclosureIndependence: entry.disclosureIndependence,
      recordStableId: entry.recordStableId,
      interactionEffect: entry.interactionEffect,
      ariaLabel: entry.ariaLabel, labelledByText: entry.labelledByText,
      labelText: entry.labelText, title: entry.title, imageAlt: entry.imageAlt,
      value: entry.value, text: entry.text, visible: entry.visible,
      disabled: entry.disabled, keyboardExpectedFocusable: keyboardFocusPolicy === "required",
      keyboardFocusPolicy, keyboardFocusScope: entry.focusScope };
  });
`;
