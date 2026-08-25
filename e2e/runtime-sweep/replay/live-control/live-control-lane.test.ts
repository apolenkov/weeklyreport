import { expect, test } from "vitest";

import type { DomControlObservation } from "../dom/dom-inventory.ts";
import { planLiveControlActions } from "./live-control-lane.ts";

const control = (
  controlKey: string,
  accessibleName: string,
  role = "button",
  enabled = true,
  tagName = role === "link" ? "a" : "button",
  inputType: string | null = null,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `0001:${controlKey}`,
  order: 1,
  role,
  accessibleName,
  enabled,
  disabled: !enabled,
  visible: true,
  tagName,
  inputType,
  href: role === "link" ? "/details" : null,
});

test("plans every enabled interactive control in DOM order", () => {
  const plans = planLiveControlActions([
    control("publish", "Publish & Lock"),
    control("revoke", "Revoke submission"),
    control("open", "Open details"),
    control("save", "Save"),
  ]);

  expect(
    plans.map(({ action, policy }) => [action?.operation, policy]),
  ).toEqual([
    ["publish", undefined],
    ["revoke", undefined],
    ["click", undefined],
    [undefined, "unsafe"],
  ]);
});

test("leaves disabled and unsupported controls explicitly unexercised", () => {
  const plans = planLiveControlActions([
    control("disabled", "Open details", "button", false),
    control("textbox", "Search", "textbox"),
  ]);

  expect(
    plans.map(({ action, policy, reason }) => [action, policy, reason]),
  ).toEqual([
    [undefined, "unavailable", "Control is disabled"],
    [
      undefined,
      "unsafe",
      "Form control requires a non-mutating or disposable reset oracle",
    ],
  ]);
});

test("does not plan a background control behind an active modal", () => {
  const [plan] = planLiveControlActions([
    {
      ...control("button:Add%20new%20user:1", "Add new user"),
      keyboardExpectedFocusable: false,
      keyboardFocusPolicy: "forbidden",
      keyboardFocusScope: "background",
    },
  ]);

  expect(plan?.action).toBeUndefined();
  expect(plan).toMatchObject({
    policy: "unavailable",
    reason: "Control is blocked by an active modal",
  });
});

test("only plans bounded form values when a safety oracle is declared", () => {
  const controls = [
    control("query", "Search", "searchbox"),
    control("status", "Status", "combobox", true, "select"),
    control("submit", "Submit", "button"),
  ];

  expect(
    planLiveControlActions(controls, { formSafety: "disposable-reset" }).map(
      ({ action }) => [action?.operation, action?.safety],
    ),
  ).toEqual([
    ["fill", "irreversible"],
    ["select", "irreversible"],
    ["submit", "irreversible"],
  ]);
});

test("does not pretend potentially mutating forms are safe in non-mutating mode", () => {
  const plans = planLiveControlActions(
    [
      control("query", "Search", "searchbox"),
      control("status", "Status", "combobox", true, "select"),
      control("submit", "Submit", "button"),
    ],
    { formSafety: "non-mutating" },
  );

  expect(
    plans.map(({ action, policy, reason }) => [action, policy, reason]),
  ).toEqual([
    [
      undefined,
      "unsafe",
      "Potentially mutating form controls are not exercised without disposable-reset recovery",
    ],
    [
      undefined,
      "unsafe",
      "Potentially mutating form controls are not exercised without disposable-reset recovery",
    ],
    [
      undefined,
      "unsafe",
      "Potentially mutating form controls are not exercised without disposable-reset recovery",
    ],
  ]);
});

test("plans form operations from the semantic role and actual element", () => {
  const plans = planLiveControlActions(
    [
      control(
        "combobox:Select%20reporting%20period:1",
        "Select reporting period",
        "combobox",
        true,
        "button",
      ),
      control(
        "combobox:Search%20Reports:1",
        "Search Reports",
        "combobox",
        true,
        "input",
        "search",
      ),
      control(
        "combobox:Native%20period:1",
        "Native period",
        "combobox",
        true,
        "select",
      ),
    ],
    { formSafety: "disposable-reset" },
  );

  expect(
    plans.map(({ action }) => [action?.operation, action?.transition]),
  ).toEqual([
    ["click", "none"],
    ["fill", "none"],
    ["select", "none"],
  ]);
});

test("keeps duplicate semantic controls independently actionable", () => {
  const plans = planLiveControlActions([
    control("button:Repeat:1", "Repeat"),
    control("button:Repeat:2", "Repeat"),
  ]);

  expect(plans.map(({ action }) => action?.controlKey)).toEqual([
    "button:Repeat:1",
    "button:Repeat:2",
  ]);
});

test("binds open, cancel, and retry intent to the semantic transition", () => {
  const plans = planLiveControlActions([
    control("open", "Open details"),
    control("cancel", "Cancel"),
    control("retry", "Try again"),
  ]);

  expect(
    plans.map(({ action }) => [action?.operation, action?.transition]),
  ).toEqual([
    ["click", "open"],
    ["click", "cancel"],
    ["retry", "retry"],
  ]);
});

test("requires disposable recovery after direct mutation buttons", () => {
  const directMutations = [
    "Acknowledge · Product group",
    "Activate Lead User",
    "Archive period",
    "Archive Portal",
    "Deactivate Admin User",
    "Downgrade risk for Portal to at risk",
    "Escalate risk for Portal to blocked",
    "Mark complete",
    "Move this report to the archive",
    "Move to current week",
    "Move to next week",
    "Reopen Period",
    "Request Reopen",
    "Analysis: on-track — status set",
    "On Track",
    "At Risk",
    "Blocked",
    "Unarchive period",
  ];

  expect(
    planLiveControlActions(
      directMutations.map((name, index) => control(`mutation-${index}`, name)),
    ).map(({ action }) => [action?.operation, action?.safety]),
  ).toEqual(directMutations.map(() => ["click", "irreversible"]));
});

test("classifies reminder switches as irreversible clicks independent of label", () => {
  const plans = planLiveControlActions([
    control(
      "switch:Reminder%20active%3A%202%20hours%20after%20deadline:1",
      "Reminder active: 2 hours after deadline",
      "switch",
    ),
    control(
      "switch:Reminder%20active%3A%2024%20hours%20before%20deadline:1",
      "Reminder active: 24 hours before deadline",
      "switch",
    ),
  ]);

  expect(
    plans.map(({ action }) => [action?.operation, action?.safety]),
  ).toEqual([
    ["click", "irreversible"],
    ["click", "irreversible"],
  ]);
});

test("keeps navigation and UI-only disclosure buttons read-only", () => {
  const plans = planLiveControlActions([
    control("sign-out", "Sign out"),
    control("respond", "Respond"),
    control("archive", "Archive"),
    control("reopen-requests", "Reopen requests", "link"),
    control("link", "Settings", "link"),
  ]);

  expect(plans.map(({ action }) => action?.safety)).toEqual([
    "read-only",
    "read-only",
    "read-only",
    "read-only",
    "read-only",
  ]);
});

test("withholds asynchronous exports without a queue-cleanup oracle", () => {
  const [plan] = planLiveControlActions([control("export", "Export PDF")]);

  expect(plan?.action).toBeUndefined();
  expect(plan).toMatchObject({
    policy: "unsafe",
    reason:
      "Async PDF export requires a dedicated job-completion and queue-cleanup oracle",
  });
});
