import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ACTIVITY_NAME_LENGTH,
  MAX_REOPEN_REASON_LENGTH,
  SAFE_TEXT_MAX_LENGTH,
} from "@weeklyreport/shared";

import { shortItemLabel } from "../../apps/web/src/shared/lib/format/short-label.js";
import { loginAsHead, openLeadReport } from "./access.js";
import {
  type BrowserSnapshot,
  close,
  command,
  fill,
  findRole,
  getAttr,
  getUrl,
  headSession,
  refsByRole,
  reload,
  snapshot,
  waitText,
} from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import { assertFocused, centerControl } from "./focus.js";
import {
  clickBackdrop,
  LEAD_FORM_FIXTURE,
  oneRef,
  roleText,
  saveDraft,
  scopeCount,
  scopedRef,
  scopeSnapshot,
  setOffline,
  waitButton,
  waitClosed,
  waitNotification,
  waitScope,
  waitSnapshot,
} from "./helpers.js";
import { scopeSnapshots } from "./snapshot-scope.js";

registerE2eHooks();

const SAVE_ROUTE = "**/trpc/*reports.saveDraft*";
const REOPEN_ROUTE = "**/trpc/*leadForm.requestReopen*";
const ACTIVITY_FORM = {
  role: "form",
  name: `Current week update for ${LEAD_FORM_FIXTURE.activityName}`,
};
const WEEKLY_FORM = {
  role: "form",
  name: `Weekly fields for ${LEAD_FORM_FIXTURE.activityName}`,
};
const ACTIVITY_ARTICLE = `Activity ${LEAD_FORM_FIXTURE.activityName}`;
const WEEKLY_EDIT = `Edit weekly fields for ${LEAD_FORM_FIXTURE.activityName}`;
const VIEW_MODE = { role: "group", name: "View mode" };

interface Scope {
  readonly role: string;
  readonly name: string;
}

function namedScope(data: BrowserSnapshot, scope: Scope): BrowserSnapshot {
  return scopeSnapshot(data, scope.role, scope.name);
}

function disabledRef(
  data: BrowserSnapshot,
  role: string,
  name: string,
): string {
  const ref = oneRef(data, role, name);
  const refPattern = new RegExp(String.raw`\bref=${ref.slice(1)}\b`);
  const lines = data.snapshot
    .split("\n")
    .filter((line) => refPattern.test(line));
  assert.equal(lines.length, 1, "Expected one current accessibility node");
  assert.match(lines.at(0) ?? "", /(?:\[|, )disabled(?=[,\]])/);
  return ref;
}

// The header cluster hands over to the sticky one while the page is scrolled
// or an update is open; exactly one of them is ever in the tree.
const COMPLETION_GROUPS = [
  "Header completion actions",
  "Sticky completion actions",
];

function completionActions(data: BrowserSnapshot): BrowserSnapshot {
  const groups = COMPLETION_GROUPS.flatMap((name) =>
    scopeSnapshots(data, "group", name),
  );
  assert.equal(groups.length, 1, "Expected one completion actions cluster");
  const group = groups.at(0);
  assert(group);
  return group;
}

async function clickCompletion(name: string): Promise<void> {
  const data = await waitSnapshot(
    (observed) =>
      COMPLETION_GROUPS.reduce(
        (count, group) => count + scopeCount(observed, "group", group),
        0,
      ) === 1,
    "Expected one completion actions cluster",
  );
  await command(["click", oneRef(completionActions(data), "button", name)]);
}

function assertPendingSubmissionActions(data: BrowserSnapshot): void {
  assert.equal(refsByRole(data, "button", "Submit report").length, 0);
  disabledRef(completionActions(data), "button", "Submit");
}

async function clickIn(
  scope: Scope,
  name: string,
  session?: string,
): Promise<void> {
  const ref = await scopedRef(scope, "button", name, session);
  // Centre the button first: at the viewport edge the fixed completion cluster covers it.
  await command(["scrollintoview", ref], session);
  await command(["click", ref], session);
}

async function fillIn(
  scope: Scope,
  name: string | RegExp,
  value: string,
): Promise<void> {
  await command(["fill", await scopedRef(scope, "textbox", name), value]);
}

async function inputValue(
  scope: Scope,
  name: string | RegExp,
  session?: string,
): Promise<string> {
  const data = await command(
    ["get", "value", await scopedRef(scope, "textbox", name, session)],
    session,
  );
  assert(typeof data.value === "string", "Invalid textbox value result");
  return data.value;
}

function scopePredicate(scope: Scope): string {
  const role = JSON.stringify(scope.role);
  const name = JSON.stringify(scope.name);
  return String.raw`(element.getAttribute('role') === ${role} || (${role} === 'form' && element.tagName === 'FORM')) && (element.getAttribute('aria-label') === ${name} || (element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent?.replace(/\s+/g, ' ').trim() || '').join(' ') === ${name})`;
}

/** The item's status icon: a button on editable rows named with the full item text. */
function statusName(text: string): RegExp {
  const label = text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
  return new RegExp(`^Status of ${label}: `);
}

// Row actions stay clipped until the item is hovered or holds focus.
const ACTIONS_REVEALED = `(() => { const zone = document.activeElement?.closest('[data-overview-item-actions]'); return zone !== null && zone !== undefined && zone.getBoundingClientRect().width > 0 && zone.getAnimations().length === 0; })()`;

// Row actions are revealed on hover or focus; focus first so the click lands.
async function clickRevealed(
  role: string,
  name: string | RegExp,
  session?: string,
): Promise<void> {
  const ref = oneRef(await snapshot(session), role, name);
  await command(["focus", ref], session);
  await command(["wait", "--fn", ACTIONS_REVEALED], session);
  await command(["click", ref], session);
}

/** Opens the canonical item editor from the row's overflow menu. */
async function openItemEditor(text: string, session?: string): Promise<void> {
  const label = shortItemLabel(text);
  await clickRevealed("button", `More actions for ${label}`, session);
  await findRole("menuitem", `Edit details: ${label}`, "click", { session });
}

async function clickPoint(x: number, y: number): Promise<void> {
  await command([
    "mouse",
    "move",
    String(Math.round(x)),
    String(Math.round(y)),
  ]);
  await command(["mouse", "down", "left"]);
  await command(["mouse", "up", "left"]);
}

async function clickDisabledButton(data: BrowserSnapshot, name: string) {
  const ref = disabledRef(data, "button", name);
  const box = await command(["get", "box", ref]);
  assert(typeof box.x === "number");
  assert(typeof box.y === "number");
  assert(typeof box.width === "number" && box.width > 0);
  assert(typeof box.height === "number" && box.height > 0);
  await clickPoint(box.x + box.width / 2, box.y + box.height / 2);
}

async function startActivityUpdate(text: string): Promise<void> {
  await findRole(
    "button",
    `Add item to ${LEAD_FORM_FIXTURE.activityName}`,
    "click",
  );
  await fillIn(ACTIVITY_FORM, "Description *", text);
}

async function reportActionsDisabled(): Promise<boolean> {
  const data = await command([
    "eval",
    `Array.from(document.getElementsByTagName('fieldset')).filter(element => element.getElementsByTagName('legend')[0]?.textContent?.trim() === 'Report actions').map(element => element.disabled)`,
  ]);
  assert(Array.isArray(data.result), "Invalid report-action fieldset result");
  assert.equal(data.result.length, 1, "Expected the Report actions fieldset");
  const disabled: unknown = data.result.at(0);
  assert(typeof disabled === "boolean", "Invalid report-action disabled state");
  return disabled;
}

async function saveActivityUpdate(text: string): Promise<void> {
  await clickIn(ACTIVITY_FORM, "Save update");
  await waitClosed(ACTIVITY_FORM);
  assert.equal(
    refsByRole(await snapshot(), "button", statusName(text)).length,
    1,
  );
}

async function assertPersistedItem(
  text: string,
  session?: string,
): Promise<void> {
  const prefix = `Status of ${text}: `;
  await reload(session);
  await command(
    [
      "wait",
      "--fn",
      `Array.from(document.getElementsByTagName('button')).some(element => (element.getAttribute('aria-label') ?? '').startsWith(${JSON.stringify(prefix)}))`,
    ],
    session,
  );
  assert.equal(
    refsByRole(await snapshot(session), "button", statusName(text)).length,
    1,
  );
}

async function assertSavePost(session?: string): Promise<void> {
  const data = await command(
    ["network", "requests", "--filter", "reports.saveDraft"],
    session,
  );
  assert(Array.isArray(data.requests), "Invalid tracked request list");
  assert(
    data.requests.some(
      (request: unknown) =>
        typeof request === "object" &&
        request !== null &&
        "method" in request &&
        request.method === "POST" &&
        "status" in request &&
        request.status === 200 &&
        "url" in request &&
        typeof request.url === "string" &&
        request.url.includes("reports.saveDraft"),
    ),
    "Expected an acknowledged draft-save POST",
  );
}

async function postCount(procedure: string): Promise<number> {
  const data = await command(["network", "requests", "--filter", procedure]);
  assert(Array.isArray(data.requests), "Invalid tracked request list");
  return data.requests.filter(
    (request: unknown) =>
      typeof request === "object" &&
      request !== null &&
      "method" in request &&
      request.method === "POST" &&
      "url" in request &&
      typeof request.url === "string" &&
      request.url.includes(procedure),
  ).length;
}

function previousMarketingPlan(data: BrowserSnapshot): BrowserSnapshot {
  const product = scopeSnapshot(
    data,
    "article",
    `Product ${LEAD_FORM_FIXTURE.productName}`,
  );
  const matches = scopeSnapshots(
    product,
    "group",
    /^PREVIOUSLY PLANNED/,
  ).filter((group) => group.snapshot.includes(LEAD_FORM_FIXTURE.previousText));
  assert.equal(matches.length, 1, "Expected the owning prior-plan lineage");
  const previous = matches.at(0);
  assert(previous);
  return previous;
}

function snapshotNodeName(data: BrowserSnapshot): string {
  const match = /^\s*- \S+ ("(?:\\.|[^"\\])*")/u.exec(data.snapshot);
  assert(match?.[1], "Expected a named accessibility node");
  const name: unknown = JSON.parse(match[1]);
  assert(typeof name === "string", "Expected an accessibility name");
  return name;
}

function previousPlanData(previous: BrowserSnapshot) {
  let content = previous.snapshot;
  for (const button of scopeSnapshots(previous, "button")) {
    content = content.replaceAll(button.snapshot, "");
  }
  return {
    period: snapshotNodeName(previous),
    values: scopeSnapshots({ snapshot: content, refs: {} }, "StaticText").map(
      snapshotNodeName,
    ),
  };
}

function assertPreviousControls(previous: BrowserSnapshot, canPlan: boolean) {
  // The prior occurrence stays read-only: its status icon is not a button, and
  // the verdict rail (one icon per verdict) only exists while writes are open.
  assert.equal(refsByRole(previous, "button", /^Status of /).length, 0);
  assert.equal(
    scopeCount(
      previous,
      "group",
      `Verdict for ${LEAD_FORM_FIXTURE.previousText}`,
    ),
    canPlan ? 1 : 0,
  );
  for (const verdict of ["Done", "Continue", "Next week", "Paused"]) {
    assert.equal(
      refsByRole(
        previous,
        "button",
        `${verdict} — ${LEAD_FORM_FIXTURE.previousText}`,
      ).length,
      canPlan ? 1 : 0,
    );
  }
}

async function saveConcurrentLeadUpdate(
  form: Scope,
  text: string,
  session: string,
): Promise<void> {
  await openLeadReport("overview", session);
  await command(["network", "requests"], session);
  await openItemEditor(LEAD_FORM_FIXTURE.currentText, session);
  await command(
    ["fill", await scopedRef(form, "textbox", "Description *", session), text],
    session,
  );
  await clickIn(form, "Save update", session);
  await waitClosed(form, session);
  await assertSavePost(session);
  await assertPersistedItem(text, session);
}

async function assertConflictingSave(): Promise<void> {
  const data = await command([
    "network",
    "requests",
    "--filter",
    "reports.saveDraft",
  ]);
  assert(Array.isArray(data.requests), "Invalid tracked request list");
  const rejected: unknown[] = data.requests.filter(
    (request: unknown) =>
      typeof request === "object" &&
      request !== null &&
      "method" in request &&
      request.method === "POST" &&
      "status" in request &&
      request.status === 409,
  );
  assert.equal(rejected.length, 1, "Expected one stale draft-write conflict");
  const request = rejected.at(0);
  assert(typeof request === "object" && request !== null);
  assert("requestId" in request && typeof request.requestId === "string");
  const detail = await command(["network", "request", request.requestId]);
  assert(typeof detail.responseBody === "string");
  assert.match(detail.responseBody, /"code"\s*:\s*"CONFLICT"/);
}

async function prepareSubmission(): Promise<void> {
  for (const productName of [
    "CRM-Customer 360",
    LEAD_FORM_FIXTURE.singleStageProductName,
  ]) {
    const form = {
      role: "form",
      name: `Current week update for ${productName}`,
    };
    await findRole("button", `Add item to ${productName}`, "click");
    await fillIn(
      form,
      "Description *",
      `E2E current commitment for ${productName}`,
    );
    if (productName === "CRM-Customer 360") {
      const development = oneRef(
        namedScope(await snapshot(), form),
        "checkbox",
        "Development",
      );
      await centerControl(development);
      await command(["check", development]);
    } else {
      assert.match(namedScope(await snapshot(), form).snapshot, /Development/);
      assert.match(
        namedScope(await snapshot(), form).snapshot,
        /Applied automatically/,
      );
    }
    await clickIn(form, "Save update");
    await waitClosed(form);
  }
  await confirmCarriedItem();
  await waitText("This report is ready to submit.");
}

// A suggested continuation counts as one item to review until the lead picks
// the status it already shows; no separate Confirm action exists.
async function confirmCarriedItem(): Promise<void> {
  const status = statusName(LEAD_FORM_FIXTURE.carriedText);
  const unconfirmed = new RegExp(`${status.source}.*not updated this week`);
  const before = await snapshot();
  assert.equal(
    scopeCount(completionActions(before), "StaticText", "1 to review"),
    1,
  );
  await command(["click", oneRef(before, "button", unconfirmed)]);
  await findRole("menuitem", "In progress", "click");
  await waitSnapshot(
    (data) =>
      scopeCount(completionActions(data), "StaticText", /to review$/) === 0 &&
      refsByRole(data, "button", unconfirmed).length === 0,
    "Expected the status choice to confirm the carried item",
  );
  assert.equal(refsByRole(await snapshot(), "button", status).length, 1);
  await saveDraft();
}

async function submitReport(currentCount = 6): Promise<void> {
  await clickCompletion("Submit");
  const confirmation = { role: "alertdialog", name: "Confirm submission" };
  const contents = await roleText("alertdialog", confirmation.name);
  assert.match(
    contents,
    new RegExp(String.raw`${currentCount}\s*current week items`),
  );
  assert.match(contents, /3\s*next week items/);
  assert.match(contents, /1\s*risk/);
  assert.match(contents, /2\s*decisions/);
  assert.match(contents, /Your report will be locked/);
  await clickIn(confirmation, "Submit");
  await waitText("Report submitted");
  await waitClosed(confirmation);
  await waitText("Submitted");
  await assertSubmitted();
}

async function assertSubmitted(): Promise<void> {
  const data = await snapshot();
  assert.match(data.snapshot, /Submitted/);
  assert.equal(refsByRole(data, "button", "Save draft now").length, 0);
  assert.equal(refsByRole(data, "button", "Submit").length, 0);
  assert.equal(refsByRole(data, "button", "Submit report").length, 0);
  assert.equal(
    refsByRole(data, "button", `Add item to ${LEAD_FORM_FIXTURE.activityName}`)
      .length,
    0,
  );
  assert.equal(
    refsByRole(data, "button", statusName(LEAD_FORM_FIXTURE.currentText))
      .length,
    0,
  );
  assert.equal(refsByRole(data, "button", /^More actions for /).length, 0);
}

function headLeadRow(data: BrowserSnapshot): BrowserSnapshot {
  const summary = namedScope(data, { role: "region", name: "Period Summary" });
  const rows = scopeSnapshots(summary, "listitem").filter((block) =>
    block.snapshot.includes(LEAD_FORM_FIXTURE.leadDisplayName),
  );
  assert.equal(rows.length, 1, "Expected the owning Lead in the Head queue");
  const row = rows.at(0);
  assert(row);
  return row;
}

async function reopenRow(
  reason: string,
  session: string,
): Promise<BrowserSnapshot> {
  const queue = namedScope(await snapshot(session), {
    role: "region",
    name: "Pending reopen requests",
  });
  const rows = scopeSnapshots(queue, "listitem").filter((block) =>
    block.snapshot.includes(reason),
  );
  assert.equal(
    rows.length,
    1,
    "Expected exactly the request created in this test",
  );
  const row = rows.at(0);
  assert(row);
  return row;
}

async function respondToReopen(
  reason: string,
  decision: "Approve" | "Reject",
): Promise<void> {
  const session = headSession();
  try {
    await loginAsHead(session);
    await waitText(reason, session);
    await command(
      ["click", oneRef(await reopenRow(reason, session), "button", "Respond")],
      session,
    );
    await fill(
      "Comment (optional, up to 500 characters)",
      `E2E ${decision.toLowerCase()} response`,
      session,
    );
    await findRole("button", "Cancel", "click", { session });
    await command(
      ["click", oneRef(await reopenRow(reason, session), "button", "Respond")],
      session,
    );
    await fill(
      "Comment (optional, up to 500 characters)",
      `E2E ${decision.toLowerCase()} response`,
      session,
    );
    await findRole("button", decision, "click", { session });
    await command(
      [
        "wait",
        "--fn",
        `!document.body.textContent.includes(${JSON.stringify(reason)})`,
      ],
      session,
    );
    assert.equal(
      scopeSnapshots(await snapshot(session), "listitem").filter((block) =>
        block.snapshot.includes(reason),
      ).length,
      0,
    );
  } finally {
    await close(session);
  }
}

async function sendReopen(reason: string): Promise<void> {
  await findRole("button", "Request reopen", "click");
  const dialog = { role: "dialog", name: "Request reopen" };
  await fillIn(dialog, "Reason (optional)", reason);
  await clickIn(dialog, "Send request");
  await waitText("Reopen request sent to Head");
  await waitClosed(dialog);
  await waitButton("Request reopen", { present: false });
  assert.equal(
    refsByRole(await snapshot(), "button", "Request reopen").length,
    0,
  );
}

void test("draft changes persist after reload", async () => {
  await openLeadReport();
  await command(["network", "requests"]);
  await startActivityUpdate("E2E persisted draft item");
  await saveActivityUpdate("E2E persisted draft item");
  await saveDraft();
  await assertSavePost();
  await assertPersistedItem("E2E persisted draft item");
  // The row title opens the canonical editor with the saved text.
  await findRole("button", "Edit item: E2E persisted draft item", "click");
  assert.equal(
    await inputValue(ACTIVITY_FORM, "Description *"),
    "E2E persisted draft item",
  );
  await clickIn(ACTIVITY_FORM, "Cancel");
  await waitClosed(ACTIVITY_FORM);
});

void test("save failure preserves local changes and recovers", async () => {
  const text = "E2E retained after induced failure";
  await openLeadReport();
  await startActivityUpdate(text);
  await command(["network", "requests"]);
  await command(["network", "route", SAVE_ROUTE, "--abort"]);
  try {
    await clickIn(ACTIVITY_FORM, "Save update");
    await waitText("Save failed. Your update is still here; try saving again.");
    assert.equal(await inputValue(ACTIVITY_FORM, "Description *"), text);
    assertPendingSubmissionActions(await snapshot());
    assert.equal(await reportActionsDisabled(), true);
  } finally {
    await command(["network", "unroute", SAVE_ROUTE]);
  }
  await saveActivityUpdate(text);
  await assertSavePost();
  await assertPersistedItem(text);
});

void test("failed autosave retries through the draft action and persists", async () => {
  const text = "E2E draft coordinator retry";
  await openLeadReport();
  await command(["network", "requests"]);
  // The weekly fields stay closed until the Activity's edit control opens them.
  assert.equal(scopeCount(await snapshot(), "form", WEEKLY_FORM.name), 0);
  await findRole("button", WEEKLY_EDIT, "click");
  await command(["network", "route", SAVE_ROUTE, "--abort"]);
  try {
    await fillIn(WEEKLY_FORM, "Description", text);
    await clickIn(WEEKLY_FORM, "Save weekly fields");
    await waitClosed(WEEKLY_FORM);
    await waitText("Draft save failed. Use Save to retry.");
    // The unsaved value stays visible as read-only text in the Activity header.
    assert.ok(
      scopeSnapshot(
        await snapshot(),
        "article",
        ACTIVITY_ARTICLE,
      ).snapshot.includes(text),
    );
    const ref = oneRef(await snapshot(), "button", "Retry saving draft");
    const state = await command(["is", "enabled", ref]);
    assert.equal(state.enabled, true);
  } finally {
    await command(["network", "unroute", SAVE_ROUTE]);
  }
  await saveDraft();
  await assertSavePost();
  await reload();
  await waitText(text);
  await findRole("button", WEEKLY_EDIT, "click");
  assert.equal(await inputValue(WEEKLY_FORM, "Description"), text);
  // Cancel closes the form and returns focus to the edit control.
  await clickIn(WEEKLY_FORM, "Cancel");
  await waitClosed(WEEKLY_FORM);
  await assertFocused(WEEKLY_EDIT);
});

void test("pending canonical save locks write actions until connectivity returns", async () => {
  const text = "E2E paused canonical save";
  await openLeadReport();
  await startActivityUpdate(text);
  await command(["network", "requests"]);
  await command(["network", "requests", "--clear"]);
  try {
    await setOffline(true);
    await clickIn(ACTIVITY_FORM, "Save update");
    await waitButton("Saving draft", { busy: true });
    await waitText(
      "You’re offline — changes will save when the connection returns",
    );
    const saving = oneRef(await snapshot(), "button", "Saving draft");
    assert.equal(await getAttr(saving, "aria-busy"), "true");
    assert.equal((await command(["is", "enabled", saving])).enabled, false);
    const editor = namedScope(await snapshot(), ACTIVITY_FORM);
    disabledRef(editor, "button", "Save update");
    assert.equal(
      (await command(["is", "enabled", oneRef(editor, "button", "Cancel")]))
        .enabled,
      true,
      "Cancel must remain reachable while the canonical save is paused",
    );
    const pending = await snapshot();
    assert.equal(refsByRole(pending, "button", /^Add item to /).length, 0);
    assert.equal(refsByRole(pending, "button", /^Status of /).length, 0);
    assertPendingSubmissionActions(pending);
    assert.equal(await reportActionsDisabled(), true);
    await command(["press", "Escape"]);
    // Escape during a paused save keeps the editor open with its text; what Escape
    // should do here is a product decision (TASK-506), so no dialog is required.
    assert.equal(await inputValue(ACTIVITY_FORM, "Description *"), text);
    assert.equal(
      await postCount("reports.saveDraft"),
      0,
      "A paused mutation must wait before sending the save POST",
    );
  } finally {
    await setOffline(false);
  }
  await waitClosed(ACTIVITY_FORM);
  assert.equal(
    refsByRole(await snapshot(), "alertdialog", "Discard changes?").length,
    0,
    "The settled pending save leaves no discard dialog behind",
  );
  await saveDraft();
  await assertSavePost();
  await assertPersistedItem(text);
});

void test("pending edits guard navigation and competing write actions", async () => {
  const text = "E2E pending input";
  await openLeadReport();
  const originalUrl = await getUrl();
  await startActivityUpdate(text);
  await waitText(
    "Save or cancel the open update before submitting the report.",
  );
  assertPendingSubmissionActions(await snapshot());
  assert.equal(await reportActionsDisabled(), true);
  await command(["click", await scopedRef(VIEW_MODE, "link", "Slides")]);
  const dialog = await command(["dialog", "status"]);
  assert.equal(dialog.hasDialog, true);
  assert.equal(dialog.type, "confirm");
  assert.equal(
    dialog.message,
    "You have an unsaved update. Do you want to leave this page?",
  );
  await command(["dialog", "dismiss"]);
  assert.equal(await getUrl(), originalUrl);
  assert.equal(await inputValue(ACTIVITY_FORM, "Description *"), text);
  await clickIn(ACTIVITY_FORM, "Cancel");
  await clickIn(
    { role: "alertdialog", name: "Discard changes?" },
    "Keep editing",
  );
  assert.equal(await inputValue(ACTIVITY_FORM, "Description *"), text);
  await clickIn(ACTIVITY_FORM, "Cancel");
  await clickIn({ role: "alertdialog", name: "Discard changes?" }, "Discard");
  await waitClosed(ACTIVITY_FORM);
  assert.equal(await reportActionsDisabled(), false);
});

void test("accepted navigation retains pending input without changing the saved report", async () => {
  const text = "E2E uncommitted input after accepted navigation";
  const path = `/lead/report/${LEAD_FORM_FIXTURE.reportId}`;
  const deck = {
    role: "group",
    name: "Status slide deck (use arrow keys to navigate slides)",
  };
  await openLeadReport();
  await startActivityUpdate(text);
  await command(["network", "requests"]);
  await command(["network", "requests", "--clear"]);
  const clicked = await command([
    "click",
    await scopedRef(VIEW_MODE, "link", "Slides"),
  ]);
  assert.equal(clicked.dialogOpened, true);
  const dialog = await command(["dialog", "status"]);
  assert.equal(dialog.hasDialog, true);
  assert.equal(dialog.type, "confirm");
  assert.equal(
    dialog.message,
    "You have an unsaved update. Do you want to leave this page?",
  );
  const accepted = await command(["dialog", "accept"]);
  assert.equal(accepted.handled, true);
  assert.equal(accepted.accepted, true);
  await command(["wait", "--url", "**/lead/report**mode=slides**"]);
  const slidesUrl = new URL(await getUrl());
  assert.equal(slidesUrl.pathname, path);
  assert.equal(slidesUrl.searchParams.get("mode"), "slides");
  await waitScope(deck);
  await findRole("button", "Document", "click");
  const slides = namedScope(await snapshot(), deck);
  assert(slides.snapshot.includes(LEAD_FORM_FIXTURE.currentText));
  assert(!slides.snapshot.includes(text));
  assert.equal(await postCount("reports.saveDraft"), 0);
  await command(["click", await scopedRef(VIEW_MODE, "link", "Report")]);
  await command(["wait", "--url", `**${path}`]);
  assert.equal(new URL(await getUrl()).pathname, path);
  assert.equal(new URL(await getUrl()).search, "");
  await waitScope(ACTIVITY_FORM);
  await waitClosed({ role: "region", name: "Unsaved update recovery" });
  assert.equal(await inputValue(ACTIVITY_FORM, "Description *"), text);
  assert.equal(
    scopeCount(await snapshot(), "region", "Unsaved update recovery"),
    0,
  );
  await clickIn(ACTIVITY_FORM, "Cancel");
  await clickIn({ role: "alertdialog", name: "Discard changes?" }, "Discard");
  await waitClosed(ACTIVITY_FORM);
  await reload();
  await waitButton(WEEKLY_EDIT);
  const persisted = await snapshot();
  assert(persisted.snapshot.includes(LEAD_FORM_FIXTURE.currentText));
  assert(!persisted.snapshot.includes(text));
  assert.equal(scopeCount(persisted, "form", ACTIVITY_FORM.name), 0);
  assert.equal(refsByRole(persisted, "button", statusName(text)).length, 0);
  assert.equal(await postCount("reports.saveDraft"), 0);
});

void test("concurrent Lead edits recover unsaved input without overwriting the saved report", async () => {
  const form = {
    role: "form",
    name: `Current week update for ${LEAD_FORM_FIXTURE.productName}`,
  };
  const recovery = { role: "region", name: "Unsaved update recovery" };
  const localText = "E2E unconfirmed first-session update";
  const serverText = "E2E authoritative second-session update";
  const peerSession = headSession();
  await openLeadReport();
  const initialPrevious = previousMarketingPlan(await snapshot());
  const previous = previousPlanData(initialPrevious);
  assertPreviousControls(initialPrevious, true);
  await openItemEditor(LEAD_FORM_FIXTURE.currentText);
  await fillIn(form, "Description *", localText);
  await command(["network", "requests"]);
  await command(["network", "requests", "--clear"]);
  try {
    try {
      // Offline reads keep the first session's loaded version until its save
      // captures that version; the second session writes through the real UI.
      await setOffline(true);
      await saveConcurrentLeadUpdate(form, serverText, peerSession);
      assert.equal(await inputValue(form, "Description *"), localText);
      await clickIn(form, "Save update");
      await waitButton("Saving draft", { busy: true });
      assert.equal(await postCount("reports.saveDraft"), 0);
    } finally {
      await setOffline(false);
    }
    await waitSnapshot(
      (data) =>
        scopeCount(data, recovery.role, recovery.name) === 1 &&
        scopeCount(
          scopeSnapshot(data, recovery.role, recovery.name),
          "StaticText",
          "Your submitted update was not confirmed. It is kept below and has not overwritten the current draft.",
        ) > 0,
      "Expected unconfirmed update in Unsaved update recovery",
    );
    await waitNotification(
      "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.",
    );
    await waitButton("Saving draft", { present: false });
    await assertConflictingSave();
    const data = await snapshot();
    const retained = namedScope(data, recovery);
    disabledRef(retained, "button", "Save update");
    assert.equal(await inputValue(form, "Description *"), localText);
    assert(retained.snapshot.includes("Saving is disabled"));
    const product = scopeSnapshot(
      data,
      "article",
      `Product ${LEAD_FORM_FIXTURE.productName}`,
    );
    assert(product.snapshot.includes(serverText));
    assert(!product.snapshot.includes(localText));
    const retainedPrevious = previousMarketingPlan(data);
    assert.deepEqual(previousPlanData(retainedPrevious), previous);
    assertPreviousControls(retainedPrevious, false);
    assert.equal(refsByRole(data, "button", /^Add item to /).length, 0);
    assert.equal(refsByRole(data, "button", /^Status of /).length, 0);
    assertPendingSubmissionActions(data);
    assert.equal(await reportActionsDisabled(), true);
    await clickIn(recovery, "Cancel");
    await clickIn({ role: "alertdialog", name: "Discard changes?" }, "Discard");
    await waitClosed(form);
    await waitClosed(recovery);
    assert.equal(await reportActionsDisabled(), false);
    await assertPersistedItem(serverText);
    const persisted = await snapshot();
    assert(!persisted.snapshot.includes(localText));
    assert.equal(scopeCount(persisted, "region", recovery.name), 0);
    const persistedPrevious = previousMarketingPlan(persisted);
    assert.deepEqual(previousPlanData(persistedPrevious), previous);
    assertPreviousControls(persistedPrevious, true);
    assert.equal(await postCount("reports.saveDraft"), 1);
  } finally {
    await close(peerSession);
  }
});

void test("submit, reopen and resubmit restore editability", async () => {
  await openLeadReport();
  await prepareSubmission();
  await clickCompletion("Submit");
  const confirmation = { role: "alertdialog", name: "Confirm submission" };
  assert.match(
    namedScope(await waitScope(confirmation), confirmation).snapshot,
    /not set.*marked On Track/s,
  );
  await clickIn(confirmation, "Cancel");
  await waitClosed(confirmation);
  assert.equal(
    refsByRole(await snapshot(), "button", "Request reopen").length,
    0,
  );
  await submitReport();
  await reload();
  await waitText("Submitted");
  await assertSubmitted();
  await sendReopen("E2E reopen approval");
  await respondToReopen("E2E reopen approval", "Approve");
  await reload();
  await waitButton("Save draft now");
  assert.equal(
    refsByRole(await snapshot(), "button", "Save draft now").length,
    1,
  );
  await startActivityUpdate("E2E correction after reopen");
  await saveActivityUpdate("E2E correction after reopen");
  await saveDraft();
  await assertPersistedItem("E2E correction after reopen");
  await submitReport(7);
  await reload();
  await waitText("Submitted");
  await assertSubmitted();
});

void test("Head rejection keeps the Lead report submitted", async () => {
  await openLeadReport();
  await prepareSubmission();
  await submitReport();
  await sendReopen("E2E rejected reopen");
  await respondToReopen("E2E rejected reopen", "Reject");
  await reload();
  await waitText("Submitted");
  await assertSubmitted();
  assert.equal(
    refsByRole(await snapshot(), "button", "Request reopen").length,
    1,
  );
});

void test("Head request changes returns reason to Lead", async () => {
  await openLeadReport();
  await prepareSubmission();
  await submitReport();
  const reason = "E2E reviewer requires a clearer delivery outcome";
  const session = headSession();
  try {
    await loginAsHead(session);
    await waitText("Period Summary", session);
    await command(
      [
        "click",
        oneRef(
          headLeadRow(await snapshot(session)),
          "button",
          `Details for ${LEAD_FORM_FIXTURE.leadDisplayName}`,
        ),
      ],
      session,
    );
    await command(
      [
        "click",
        oneRef(
          headLeadRow(await snapshot(session)),
          "button",
          `Request changes from ${LEAD_FORM_FIXTURE.leadDisplayName}`,
        ),
      ],
      session,
    );
    const dialog = {
      role: "dialog",
      name: `Request changes from ${LEAD_FORM_FIXTURE.leadDisplayName}`,
    };
    await clickIn(dialog, "Request changes", session);
    await waitText("Enter a reason for the lead.", session);
    const field = await scopedRef(
      dialog,
      "textbox",
      "Reason for the lead",
      session,
    );
    assert.equal(await getAttr(field, "aria-invalid", session), "true");
    await command(["fill", field, reason], session);
    await clickIn(dialog, "Request changes", session);
    await waitClosed(dialog, session);
    await command(
      [
        "wait",
        "--fn",
        `Array.from(document.getElementsByTagName('li')).some(element => element.textContent.includes(${JSON.stringify(LEAD_FORM_FIXTURE.leadDisplayName)}) && element.textContent.includes('In progress') && element.textContent.includes('Changes requested'))`,
      ],
      session,
    );
    const updatedLead = headLeadRow(await snapshot(session));
    assert.match(updatedLead.snapshot, /StaticText "In progress"/);
    assert.match(updatedLead.snapshot, /StaticText "Changes requested"/);
  } finally {
    await close(session);
  }
  await reload();
  await waitText(reason);
  const contents = await roleText("region", "Reviewer feedback");
  assert(contents.includes(reason));
  assert(
    contents
      .toLowerCase()
      .includes(
        `Changes requested by ${LEAD_FORM_FIXTURE.headName}`.toLowerCase(),
      ),
  );
  await startActivityUpdate("E2E revised delivery outcome");
  await saveActivityUpdate("E2E revised delivery outcome");
  await saveDraft();
  await assertPersistedItem("E2E revised delivery outcome");
  await submitReport(7);
  await reload();
  await waitText("Submitted");
  await assertSubmitted();
  assert(
    !namedScope(await snapshot(), {
      role: "region",
      name: "Reviewer feedback",
    }).snapshot.includes(reason),
  );
});

void test("reopen reason limits, dirty cancel and failed request retain input", async () => {
  await openLeadReport();
  await prepareSubmission();
  await submitReport();
  await findRole("button", "Request reopen", "click");
  const dialog = { role: "dialog", name: "Request reopen" };
  await fillIn(
    dialog,
    "Reason (optional)",
    "x".repeat(MAX_REOPEN_REASON_LENGTH + 1),
  );
  assert.equal(
    await getAttr(
      await scopedRef(dialog, "textbox", "Reason (optional)"),
      "aria-invalid",
    ),
    "true",
  );
  assert.equal(
    (
      await command([
        "is",
        "enabled",
        await scopedRef(dialog, "button", "Send request"),
      ])
    ).enabled,
    false,
  );
  assert.match(
    namedScope(await snapshot(), dialog).snapshot,
    /501 \/ 500 characters.*1 over the limit/,
  );
  await fillIn(
    dialog,
    "Reason (optional)",
    "r".repeat(MAX_REOPEN_REASON_LENGTH),
  );
  assert.equal(
    await getAttr(
      await scopedRef(dialog, "textbox", "Reason (optional)"),
      "aria-invalid",
    ),
    "false",
  );
  await clickIn(dialog, "Cancel");
  await clickIn(
    { role: "alertdialog", name: "Discard changes?" },
    "Keep editing",
  );
  assert.equal(
    await inputValue(dialog, "Reason (optional)"),
    "r".repeat(MAX_REOPEN_REASON_LENGTH),
  );
  await clickIn(dialog, "Cancel");
  await clickIn({ role: "alertdialog", name: "Discard changes?" }, "Discard");
  await waitClosed(dialog);
  await findRole("button", "Request reopen", "click");
  assert.equal(await inputValue(dialog, "Reason (optional)"), "");
  const reason = "E2E reopen transport retry ".padEnd(
    MAX_REOPEN_REASON_LENGTH,
    "x",
  );
  await fillIn(dialog, "Reason (optional)", reason);
  await command(["network", "route", REOPEN_ROUTE, "--abort"]);
  try {
    await clickIn(dialog, "Send request");
    await command([
      "wait",
      "--fn",
      `Array.from(document.getElementsByTagName('*')).some(element => ${scopePredicate(dialog)} && Array.from(element.getElementsByTagName('p')).some(message => message.getAttribute('role') === 'alert' && message.textContent.trim().length > 0))`,
    ]);
    assert.equal(await inputValue(dialog, "Reason (optional)"), reason);
    assert.equal(
      (
        await command([
          "is",
          "enabled",
          await scopedRef(dialog, "button", "Send request"),
        ])
      ).enabled,
      true,
    );
  } finally {
    await command(["network", "unroute", REOPEN_ROUTE]);
  }
  await clickIn(dialog, "Send request");
  await waitText("Reopen request sent to Head");
  await waitClosed(dialog);
  await waitButton("Request reopen", { present: false });
  assert.equal(
    refsByRole(await snapshot(), "button", "Request reopen").length,
    0,
  );
  const session = headSession();
  try {
    await loginAsHead(session);
    await waitText(reason, session);
    assert(
      (await roleText("region", "Pending reopen requests", session)).includes(
        reason,
      ),
    );
  } finally {
    await close(session);
  }
});

void test("reopen supports an empty optional reason", async () => {
  await openLeadReport();
  await prepareSubmission();
  await submitReport();
  await findRole("button", "Request reopen", "click");
  const dialog = { role: "dialog", name: "Request reopen" };
  assert.equal(await inputValue(dialog, "Reason (optional)"), "");
  await command([
    "focus",
    await scopedRef(dialog, "textbox", "Reason (optional)"),
  ]);
  await command([
    "press",
    process.platform === "darwin" ? "Meta+Enter" : "Control+Enter",
  ]);
  await waitText("Reopen request sent to Head");
  await waitClosed(dialog);
  await waitButton("Request reopen", { present: false });
  await reload();
  await waitText("Submitted");
  await assertSubmitted();
  assert.equal(
    refsByRole(await snapshot(), "button", "Request reopen").length,
    0,
  );
});

async function assertPendingReopen(reason: string): Promise<void> {
  const data = await snapshot();
  const dialog = namedScope(data, { role: "dialog", name: "Request reopen" });
  for (const [role, name] of [
    ["textbox", "Reason (optional)"],
    ["button", "Cancel"],
    ["button", "Sending…"],
  ] as const)
    disabledRef(dialog, role, name);
  assert.equal(
    await getAttr(oneRef(dialog, "button", "Sending…"), "aria-busy"),
    "true",
  );
  assert.equal(
    await inputValue(
      { role: "dialog", name: "Request reopen" },
      "Reason (optional)",
    ),
    reason,
  );
  assert.equal(scopeCount(data, "alertdialog"), 0);
  assert.equal(await postCount("leadForm.requestReopen"), 0);
}

void test("pending reopen request preserves reason and blocks dismissal and duplicate writes", async () => {
  const reason = "E2E pending reopen request survives dismissal attempts";
  const dialog = { role: "dialog", name: "Request reopen" };
  await openLeadReport();
  await prepareSubmission();
  await submitReport();
  await findRole("button", "Request reopen", "click");
  await fillIn(dialog, "Reason (optional)", reason);
  await command(["network", "requests"]);
  await command(["network", "requests", "--clear"]);
  try {
    await setOffline(true);
    await clickIn(dialog, "Send request");
    await waitButton("Sending…", { busy: true });
    await assertPendingReopen(reason);
    await command(["press", "Escape"]);
    await assertPendingReopen(reason);
    await clickBackdrop(dialog.name);
    await assertPendingReopen(reason);
    await clickDisabledButton(namedScope(await snapshot(), dialog), "Sending…");
    await command(["press", "Control+Enter"]);
    await assertPendingReopen(reason);
  } finally {
    await setOffline(false);
  }
  await waitNotification("Reopen request sent to Head");
  await waitClosed(dialog);
  await waitButton("Request reopen", { present: false });
  assert.equal(await postCount("leadForm.requestReopen"), 1);
  await reload();
  await waitText("Submitted");
  await assertSubmitted();
  assert.equal(
    refsByRole(await snapshot(), "button", "Request reopen").length,
    0,
  );
  const session = headSession();
  try {
    await loginAsHead(session);
    await waitText(reason, session);
    assert((await reopenRow(reason, session)).snapshot.includes(reason));
  } finally {
    await close(session);
  }
});

async function checkRecordLimit(
  scope: Scope,
  label: string,
  prefix: string,
  saveLabel: string,
): Promise<string> {
  const boundary = prefix.padEnd(SAFE_TEXT_MAX_LENGTH, "x");
  await fillIn(scope, label, `${boundary}x`);
  assert.equal(
    await getAttr(await scopedRef(scope, "textbox", label), "aria-invalid"),
    "true",
  );
  assert.match(
    namedScope(await snapshot(), scope).snapshot,
    /501 \/ 500 characters.*1 over the limit/,
  );
  await clickIn(scope, saveLabel);
  assert.equal(await inputValue(scope, label), `${boundary}x`);
  assert.equal(
    await getAttr(await scopedRef(scope, "textbox", label), "aria-invalid"),
    "true",
  );
  await fillIn(scope, label, boundary);
  assert.equal(
    await getAttr(await scopedRef(scope, "textbox", label), "aria-invalid"),
    "false",
  );
  return boundary;
}

void test("item description and pause reason limits accept corrected boundary values", async () => {
  await openLeadReport();
  await startActivityUpdate("E2E item description limit");
  const description = await checkRecordLimit(
    ACTIVITY_FORM,
    "Description *",
    "E2E boundary item ",
    "Save update",
  );
  await command([
    "click",
    oneRef(namedScope(await snapshot(), ACTIVITY_FORM), "button", "Paused"),
  ]);
  const reason = await checkRecordLimit(
    ACTIVITY_FORM,
    "Pause reason *",
    "E2E boundary pause ",
    "Save update",
  );
  await saveActivityUpdate(description);
  await assertPersistedItem(description);
  await openItemEditor(description);
  assert.equal(await inputValue(ACTIVITY_FORM, "Description *"), description);
  assert.equal(await inputValue(ACTIVITY_FORM, "Pause reason *"), reason);
  await clickIn(ACTIVITY_FORM, "Cancel");
  await waitClosed(ACTIVITY_FORM);
});

void test("next step limit accepts a corrected boundary value", async () => {
  const text = "E2E next step limit item";
  await openLeadReport();
  await startActivityUpdate(text);
  await saveActivityUpdate(text);
  await openLeadReport("slides");
  await findRole("button", "Document", "click");
  await findRole(
    "button",
    `Expand full details for In progress: ${text}`,
    "click",
  );
  await findRole("button", `Edit In progress: ${text}`, "click");
  const dialog = {
    role: "dialog",
    name: `Edit item — ${LEAD_FORM_FIXTURE.activityName}`,
  };
  const next = await checkRecordLimit(
    dialog,
    "Next step (optional)",
    "E2E boundary next step ",
    "Save item",
  );
  await clickIn(dialog, "Save item");
  await waitClosed(dialog);
  await reload();
  await waitButton(`Expand full details for In progress: ${text}`);
  await findRole(
    "button",
    `Expand full details for In progress: ${text}`,
    "click",
  );
  await findRole("button", `Edit In progress: ${text}`, "click");
  assert.equal(await inputValue(dialog, "Next step (optional)"), next);
  await clickIn(dialog, "Cancel");
  await waitClosed(dialog);
});

async function waitAriaLabel(label: string): Promise<void> {
  const expression = `Array.from(document.getElementsByTagName("button")).some(element => element.getAttribute("aria-label") === ${JSON.stringify(label)})`;
  await command(["wait", "--fn", expression]);
}

for (const kind of ["risk", "decision"] as const) {
  void test(`${kind} text limits reject oversized fields and persist corrected boundaries`, async () => {
    await openLeadReport();
    await findRole(
      "button",
      `Expand ${kind === "risk" ? "Risks & Blockers" : "Decisions"}`,
      "click",
    );
    await findRole("button", `+ Add ${kind}`, "click");
    await waitScope({
      role: "dialog",
      name: kind === "risk" ? /^Add risk — /u : "Add decision",
    });
    const initial = oneRef(await snapshot(), "combobox", "Parent");
    await command(["select", initial, LEAD_FORM_FIXTURE.activityName]);
    const dialog = {
      role: "dialog",
      name:
        kind === "risk"
          ? `Add risk — ${LEAD_FORM_FIXTURE.activityName}`
          : "Add decision",
    };
    const fields =
      kind === "risk"
        ? ["Risk *", "Impact *", "Mitigation *"]
        : ["Decision *", "Impact *"];
    for (const label of fields)
      await fillIn(dialog, label, `E2E ${kind} ${label}`);
    const boundaries = fields.map((label) =>
      `E2E ${kind} ${label} `.padEnd(SAFE_TEXT_MAX_LENGTH, "x"),
    );
    for (const [index, label] of fields.entries()) {
      const boundary = await checkRecordLimit(
        dialog,
        label,
        `E2E ${kind} ${label} `,
        `Save ${kind}`,
      );
      assert.equal(boundary, boundaries[index]);
    }
    await clickIn(dialog, `Save ${kind}`);
    await waitClosed(dialog);
    await saveDraft();
    await reload();
    const text = boundaries.at(0);
    assert(text);
    // The overview renders before the saved record hydrates; wait for it.
    await command([
      "wait",
      "--fn",
      `document.body.textContent.includes(${JSON.stringify(text)})`,
    ]);
    if (kind === "risk") {
      await waitButton("Expand Risks & Blockers");
      await findRole("button", "Expand Risks & Blockers", "click");
      // The expand commit is what releases the inert card actions.
      await waitAriaLabel("Collapse Risks & Blockers");
      await findRole(
        "button",
        `Edit risk for ${LEAD_FORM_FIXTURE.activityName}`,
        "click",
      );
    } else {
      await openLeadReport("slides");
      await findRole("button", "Document", "click");
      // The slide mounts before its saved records hydrate; wait for the row.
      await waitAriaLabel(`Expand full details for Decision: ${text}`);
      await findRole(
        "button",
        `Expand full details for Decision: ${text}`,
        "click",
      );
      // The details body mounts the edit action after the expand commit.
      await waitAriaLabel(`Edit Decision: ${shortItemLabel(text)}`);
      await findRole(
        "button",
        `Edit Decision: ${shortItemLabel(text)}`,
        "click",
      );
    }
    const edited = {
      role: "dialog",
      name:
        kind === "risk"
          ? `Edit risk — ${LEAD_FORM_FIXTURE.activityName}`
          : "Edit decision",
    };
    for (const [index, label] of fields.entries())
      assert.equal(await inputValue(edited, label), boundaries[index]);
    await clickIn(edited, "Cancel");
    await waitClosed(edited);
  });
}

void test("weekly title and description limits disable invalid saves and persist boundaries", async () => {
  await openLeadReport();
  await findRole("button", WEEKLY_EDIT, "click");
  for (const [label, limit] of [
    ["Weekly title", MAX_ACTIVITY_NAME_LENGTH],
    ["Description", SAFE_TEXT_MAX_LENGTH],
  ] as const) {
    const fieldName =
      label === "Weekly title" ? /^Weekly title(?: |$)/ : /^Description(?: |$)/;
    await fillIn(WEEKLY_FORM, label, "x".repeat(limit + 1));
    assert.equal(
      await getAttr(
        await scopedRef(WEEKLY_FORM, "textbox", fieldName),
        "aria-invalid",
      ),
      "true",
    );
    assert.equal(
      (
        await command([
          "is",
          "enabled",
          await scopedRef(WEEKLY_FORM, "button", "Save weekly fields"),
        ])
      ).enabled,
      false,
    );
    assert.match(
      namedScope(await snapshot(), WEEKLY_FORM).snapshot,
      new RegExp(String.raw`${label} must be ${limit} characters or fewer\.`),
    );
    await fillIn(WEEKLY_FORM, fieldName, "x".repeat(limit));
    assert.equal(
      await getAttr(
        await scopedRef(WEEKLY_FORM, "textbox", label),
        "aria-invalid",
      ),
      "false",
    );
  }
  await clickIn(WEEKLY_FORM, "Save weekly fields");
  await waitClosed(WEEKLY_FORM);
  await saveDraft();
  await reload();
  // The saved title now names the Activity and its edit control; the
  // description shows read-only in its header before the form is reopened.
  const savedTitle = "x".repeat(MAX_ACTIVITY_NAME_LENGTH);
  await waitButton(`Edit weekly fields for ${savedTitle}`);
  await waitText("x".repeat(SAFE_TEXT_MAX_LENGTH));
  await findRole("button", `Edit weekly fields for ${savedTitle}`, "click");
  assert.equal(await inputValue(WEEKLY_FORM, "Weekly title"), savedTitle);
  assert.equal(
    await inputValue(WEEKLY_FORM, "Description"),
    "x".repeat(SAFE_TEXT_MAX_LENGTH),
  );
});
