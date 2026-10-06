import assert from "node:assert/strict";
import { test } from "node:test";

import { shortItemLabel } from "../../apps/web/src/shared/lib/format/short-label.js";
import { prepareE2eData } from "../setup/reset.js";
import { openLeadReport } from "./access.js";
import {
  type BrowserSnapshot,
  command,
  fill,
  findRole,
  getAttr,
  open,
  refsByRole,
  reload,
  snapshot,
  waitText,
} from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import {
  LEAD_FORM_FIXTURE,
  OPEN_WORK_FIXTURE,
  roleText,
  saveDraft,
  type Scope,
  scopeCount,
  scopeSnapshot,
  scopeSnapshots,
  waitClosed,
  waitScope,
  waitSnapshot,
} from "./helpers.js";

registerE2eHooks();

type Week = "Current week" | "Next week";
type Column = Week | "Previously planned";
type MenuAction =
  "Edit details" | "Update status" | "Move to next week" | "Move to this week";

const ACTIVITY = LEAD_FORM_FIXTURE.activityName;
const PRODUCT = LEAD_FORM_FIXTURE.productName;
const PREVIOUS_TEXT = LEAD_FORM_FIXTURE.previousText;
const LONG_UPDATE =
  "E2E long activity update verifies that the complete description remains available after collapsing and expanding the overview preview without writing data";
const EXTRA_UPDATES = [
  LONG_UPDATE,
  "E2E additional activity update alpha",
  "E2E additional activity update beta",
] as const;
const STATUS_CHOICES = ["In progress", "Paused", "Postponed", "Done"] as const;
const ITEM_LIMIT_MESSAGE = "This section has reached its item limit.";
const REGISTER_NAME = "Open work from earlier periods";
const REGISTER = `section[aria-label="${REGISTER_NAME}"]`;
const OPEN_ITEMS_SUMMARY = /^\d+ earlier open items?$/u;
const TERMINAL_SUMMARY = /^Completed and cancelled work \(\d+\)$/u;
const HEALTH = 'section[aria-label="Report health"]';
const HEALTH_SUMMARY =
  /^Report health · \d+ of \d+ blocked · \d+ of \d+ at risk · \d+ of \d+ missing status$/u;
// Quick move, More actions, Plan this work and Restore stay in the accessibility
// tree but are clipped until the item is hovered or holds focus.
const ACTIONS_REVEALED = `(() => { const zone = document.activeElement?.closest('[data-overview-item-actions]'); return zone !== null && zone !== undefined && zone.getBoundingClientRect().width > 0 && zone.getAnimations().length === 0; })()`;

async function namedBlock(role: string, name: string): Promise<string> {
  return scopeSnapshot(await snapshot(), role, name).snapshot;
}

function roleNames(data: BrowserSnapshot, role: string) {
  return JSON.stringify(
    scopeSnapshots(data, role).map((scope) => scope.snapshot.split("\n")[0]),
  );
}

function buttonNames(block: string): string[] {
  return Array.from(
    block.matchAll(/- button "((?:\\.|[^"\\])*)"/gu),
    (match) => match[1] ?? "",
  );
}

function escapePattern(text: string): string {
  return text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
}

async function namedRef(
  role: string,
  name: string,
  scope?: Scope,
): Promise<string> {
  const observed = await snapshot();
  const data = scope
    ? scopeSnapshot(observed, scope.role, scope.name)
    : observed;
  const refs = refsByRole(data, role, name);
  assert.equal(
    refs.length,
    1,
    `${role}: ${name}; names seen: ${roleNames(data, role)}`,
  );
  const ref = refs[0];
  assert.ok(ref);
  return ref;
}

async function cancelUpdate(week: Week, parent: string = ACTIVITY) {
  await command([
    "click",
    await namedRef("button", "Cancel", {
      role: "form",
      name: `${week} update for ${parent}`,
    }),
  ]);
}

async function discardChanges() {
  const scope = { role: "alertdialog", name: "Discard changes?" };
  await waitScope(scope);
  await command(["click", await namedRef("button", "Discard", scope)]);
  await waitClosed(scope);
}

async function expandUnit(
  parent: string = ACTIVITY,
  kind = "Activity",
): Promise<void> {
  const data = await snapshot();
  const article = scopeSnapshot(data, "article", `${kind} ${parent}`);
  const more = refsByRole(article, "button", /^\+\d+ more$/);
  assert.ok(more.length <= 1);
  if (more[0]) await command(["click", more[0]]);
}

function weekGroups(
  data: BrowserSnapshot,
  column: Column,
  text: string,
  parent: string,
): BrowserSnapshot[] {
  const kind = parent === ACTIVITY ? "Activity" : "Product";
  const article = scopeSnapshot(data, "article", `${kind} ${parent}`);
  return scopeSnapshots(
    article,
    "group",
    new RegExp(`^${column.toUpperCase()}`, "u"),
  ).filter((group) => group.snapshot.includes(text));
}

// The one column group of a unit that holds this text, with its element refs.
async function weekGroup(
  column: Column,
  text: string,
  parent: string = ACTIVITY,
): Promise<BrowserSnapshot> {
  await expandUnit(parent, parent === ACTIVITY ? "Activity" : "Product");
  const matching = weekGroups(await snapshot(), column, text, parent);
  assert.equal(matching.length, 1, `${column}: ${text}`);
  const group = matching[0];
  assert.ok(group);
  return group;
}

async function weekBlock(
  column: Column,
  text: string,
  parent: string = ACTIVITY,
): Promise<string> {
  return (await weekGroup(column, text, parent)).snapshot;
}

// Names repeat across columns, so every item control is taken from its column.
async function weekControl(
  column: Column,
  text: string,
  role: string,
  name: string | RegExp,
  parent: string = ACTIVITY,
): Promise<string> {
  const group = await weekGroup(column, text, parent);
  const refs = refsByRole(group, role, name);
  assert.equal(
    refs.length,
    1,
    `${column} ${role}: ${String(name)}; names seen: ${roleNames(group, role)}`,
  );
  const ref = refs[0];
  assert.ok(ref);
  return ref;
}

function columnBlocks(article: string, week: Column) {
  return scopeSnapshots(
    { snapshot: article, refs: {} },
    "group",
    new RegExp(`^${week.toUpperCase()}`, "u"),
  ).map((group) => group.snapshot);
}

async function assertPlacement(week: Week, text: string): Promise<void> {
  await weekBlock(week, text);
  const article = await namedBlock("article", `Activity ${ACTIVITY}`);
  for (const candidate of ["Current week", "Next week"] as const) {
    assert.equal(
      columnBlocks(article, candidate).filter((group) => group.includes(text))
        .length,
      candidate === week ? 1 : 0,
    );
  }
}

// The status icon's accessible name is the item's only status text at rest.
function statusButtonName(text: string): RegExp {
  return new RegExp(`^Status of ${escapePattern(shortItemLabel(text))}: `, "u");
}

function statusLabelPattern(text: string, status: string): RegExp {
  return new RegExp(
    `"Status of ${escapePattern(shortItemLabel(text))}: ${escapePattern(status)}(?: · Unplanned)?"`,
    "u",
  );
}

async function assertStatus(
  column: Column,
  text: string,
  status: string,
  parent: string = ACTIVITY,
): Promise<void> {
  assert.match(
    await weekBlock(column, text, parent),
    statusLabelPattern(text, status),
  );
}

async function waitStatus(
  column: Week,
  text: string,
  status: string,
  parent: string = ACTIVITY,
): Promise<void> {
  const label = statusLabelPattern(text, status);
  await waitSnapshot(
    (data) =>
      weekGroups(data, column, text, parent).some((group) =>
        label.test(group.snapshot),
      ),
    `Expected ${column} status ${status}: ${text}`,
  );
}

async function statusButtonCount(text: string): Promise<number> {
  return refsByRole(await snapshot(), "button", statusButtonName(text)).length;
}

async function chooseStatus(
  column: Week,
  text: string,
  status: string,
  parent: string = ACTIVITY,
): Promise<void> {
  await command([
    "click",
    await weekControl(column, text, "button", statusButtonName(text), parent),
  ]);
  await findRole("menuitem", status, "click");
}

async function revealClick(ref: string): Promise<void> {
  await command(["focus", ref]);
  await command(["wait", "--fn", ACTIONS_REVEALED]);
  await command(["click", ref]);
}

async function moreAction(
  column: Week,
  text: string,
  action: MenuAction,
  parent: string = ACTIVITY,
): Promise<void> {
  const label = shortItemLabel(text);
  await revealClick(
    await weekControl(
      column,
      text,
      "button",
      `More actions for ${label}`,
      parent,
    ),
  );
  await findRole("menuitem", `${action}: ${label}`, "click");
}

async function quickMove(
  column: Week,
  text: string,
  parent: string = ACTIVITY,
): Promise<void> {
  const target = column === "Current week" ? "next" : "this";
  await revealClick(
    await weekControl(
      column,
      text,
      "button",
      `Quick move to ${target} week: ${shortItemLabel(text)}`,
      parent,
    ),
  );
}

function editItemName(text: string): string | RegExp {
  // Very long updates are matched by their opening so one snapshot name stays short.
  return text.length > 120
    ? new RegExp(`^Edit item: ${escapePattern(text.slice(0, 80))}`, "u")
    : `Edit item: ${text}`;
}

async function openEditor(week: Week, text: string, parent: string = ACTIVITY) {
  await command([
    "click",
    await weekControl(week, text, "button", editItemName(text), parent),
  ]);
  await namedBlock("form", `${week} update for ${parent}`);
}

async function saveUpdate(
  week: Week,
  parent: string = ACTIVITY,
): Promise<void> {
  await findRole("button", "Save update", "click");
  await waitClosed({ role: "form", name: `${week} update for ${parent}` });
  await saveDraft();
}

async function startActivity(text: string, week: Week = "Current week") {
  await findRole("button", `Add item to ${ACTIVITY}`, "click");
  await namedBlock("form", `Current week update for ${ACTIVITY}`);
  await fill("Description *", text);
  if (week === "Next week") {
    await findRole("radio", week, "click");
    await findRole("button", "Planned", "click");
  }
}

async function addActivity(text: string, week: Week = "Current week") {
  await startActivity(text, week);
  await saveUpdate(week);
}

async function pressSaveShortcut(label: string): Promise<void> {
  await command(["click", await namedRef("textbox", label)]);
  await command([
    "press",
    process.platform === "darwin" ? "Meta+Enter" : "Control+Enter",
  ]);
}

async function value(name: string): Promise<unknown> {
  const data = await command(["get", "value", await namedRef("textbox", name)]);
  return data.value;
}

async function stageChecked(name: string): Promise<boolean> {
  const data = await command([
    "is",
    "checked",
    await namedRef("checkbox", name),
  ]);
  assert.ok(typeof data.checked === "boolean");
  return data.checked;
}

async function selectedParent(): Promise<string> {
  const data = await command([
    "get",
    "value",
    await namedRef("combobox", "Parent"),
  ]);
  assert.ok(typeof data.value === "string");
  return data.value;
}

async function waitPlanFailure(name: "Resolve plan" | "Restore plan") {
  await waitText("Failed to fetch");
  const form = scopeSnapshot(await snapshot(), "form", name);
  assert.equal(scopeCount(form, "alert"), 1);
  assert.ok(form.snapshot.includes("Failed to fetch"));
  return form.snapshot;
}

async function fillOutcomeBoundary(label: string, prefix: string) {
  await waitText(label);
  assert.equal(
    await getAttr(await namedRef("textbox", label), "maxlength"),
    "500",
  );
  const boundary = prefix.padEnd(500, "x");
  await fill(label, `${boundary}x`);
  assert.equal(await value(label), boundary);
  return boundary;
}

async function writeCount(procedure?: string): Promise<number> {
  const data = await command(["network", "requests"]);
  assert.ok(Array.isArray(data.requests));
  return data.requests.filter((entry: unknown) => {
    assert.ok(typeof entry === "object" && entry !== null);
    assert.ok("method" in entry && "url" in entry);
    assert.ok(typeof entry.url === "string");
    return (
      entry.method === "POST" &&
      entry.url.includes("/trpc/") &&
      (procedure === undefined || entry.url.includes(procedure))
    );
  }).length;
}

async function historyText(reportId: string): Promise<string> {
  await open(`/lead/report/${reportId}?mode=overview`);
  await waitText("My Report");
  await waitText("Status overview");
  return roleText("region", "Status overview");
}

async function reloadOverview(): Promise<void> {
  await reload();
  await waitText("My Report");
  await waitText("Status overview");
}

interface DisclosureState {
  readonly open: boolean;
  readonly name: string;
}

function isDisclosureState(value: unknown): value is DisclosureState {
  return (
    typeof value === "object" &&
    value !== null &&
    "open" in value &&
    typeof value.open === "boolean" &&
    "name" in value &&
    typeof value.name === "string"
  );
}

function disclosureQuery(scope: string, pattern: RegExp, result: string) {
  return String.raw`(() => {
    const pattern = new RegExp(${JSON.stringify(pattern.source)}, ${JSON.stringify(pattern.flags)});
    const found = Array.from(document.querySelectorAll(${JSON.stringify(`${scope} details`)}))
      .map((details) => ({ details, name: (details.querySelector(':scope > summary')?.textContent ?? '').replace(/\s+/g, ' ').trim() }))
      .find((entry) => pattern.test(entry.name));
    return ${result};
  })()`;
}

// Opens a collapsed <details> through its summary; false when none is rendered.
async function expandDisclosure(
  scope: string,
  pattern: RegExp,
): Promise<boolean> {
  const state = (
    await command([
      "eval",
      disclosureQuery(
        scope,
        pattern,
        "found === undefined ? null : { open: found.details.open, name: found.name }",
      ),
    ])
  ).result;
  if (state === null) return false;
  assert.ok(isDisclosureState(state), "Unexpected disclosure state");
  if (!state.open) {
    await findRole("DisclosureTriangle", state.name, "click");
    await command([
      "wait",
      "--fn",
      disclosureQuery(
        scope,
        pattern,
        "found !== undefined && found.details.open",
      ),
    ]);
  }
  return true;
}

async function expandHealth(): Promise<void> {
  assert.ok(
    await expandDisclosure(HEALTH, HEALTH_SUMMARY),
    "Report health summary",
  );
}

// The register stays out of the tree until the registry finishes loading.
async function waitOpenWork(): Promise<void> {
  await command([
    "wait",
    "--fn",
    `document.querySelector(${JSON.stringify(REGISTER)})?.getAttribute('aria-busy') === 'false'`,
  ]);
}

// Open work is one collapsed line; its rows exist only once it is expanded.
async function expandOpenWork(): Promise<void> {
  await waitOpenWork();
  await expandDisclosure(REGISTER, OPEN_ITEMS_SUMMARY);
  await expandDisclosure(REGISTER, TERMINAL_SUMMARY);
}

async function openWorkRow(text: string) {
  await expandOpenWork();
  const register = scopeSnapshot(await snapshot(), "region", REGISTER_NAME);
  const matches = scopeSnapshots(register, "listitem").filter((row) =>
    row.snapshot.includes(text),
  );
  assert.equal(matches.length, 1, `Open work: ${text}`);
  const row = matches[0];
  assert.ok(row);
  return row;
}

async function assertNotInRegister(text: string): Promise<void> {
  await expandOpenWork();
  assert.ok(!(await namedBlock("region", REGISTER_NAME)).includes(text));
}

// The register suffixes each action name with the occurrence's period range,
// which differs per fixture row, so match the stable prefix only.
function openWorkActionName(action: string, text: string): RegExp {
  const prefix = `${action}: ${shortItemLabel(text)}, `;
  return new RegExp(`^${escapePattern(prefix)}`);
}

async function openWorkOutcome(text: string, action: string): Promise<void> {
  const row = await openWorkRow(text);
  const refs = refsByRole(row, "button", openWorkActionName(action, text));
  assert.equal(
    refs.length,
    1,
    `${action}; names seen: ${roleNames(row, "button")}`,
  );
  const ref = refs[0];
  assert.ok(ref);
  await command(["click", ref]);
  await waitText("Resolve plan");
}

async function recoverWork(
  text: string,
  action: string,
  outcome: "Continue" | "Plan next",
) {
  await openWorkOutcome(text, action);
  await findRole("button", outcome, "click");
  const recovered = `${text} recovered`;
  await fill(
    outcome === "Continue" ? "This period's update" : "Next-period commitment",
    recovered,
  );
  await findRole("button", "Save outcome", "click");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  await assertNotInRegister(text);
  const active = await weekBlock(
    outcome === "Continue" ? "Current week" : "Next week",
    recovered,
  );
  assert.ok(active.includes(recovered));
  await assertStatus(
    outcome === "Continue" ? "Current week" : "Next week",
    recovered,
    outcome === "Continue" ? "In progress" : "Planned",
  );
}

void test("Overview shows product and activity lineage in all three weeks", async () => {
  await openLeadReport();
  await waitText("Project activities");
  const headings = await snapshot();
  assert.equal(scopeCount(headings, "heading", "Products"), 1);
  assert.equal(scopeCount(headings, "heading", "Project activities"), 1);
  assert.ok(
    (
      await weekBlock(
        "Previously planned",
        LEAD_FORM_FIXTURE.previousText,
        PRODUCT,
      )
    ).includes(LEAD_FORM_FIXTURE.previousText),
  );
  assert.match(
    await weekBlock("Current week", LEAD_FORM_FIXTURE.currentText, PRODUCT),
    /image "Stages: Development/u,
  );
  assert.ok(
    (
      await weekBlock("Next week", LEAD_FORM_FIXTURE.nextText, PRODUCT)
    ).includes(LEAD_FORM_FIXTURE.nextText),
  );
  const activity = await namedBlock("article", `Activity ${ACTIVITY}`);
  assert.ok(activity.includes("Products:"));
  assert.ok(activity.includes("No item"));
  assert.ok(!activity.includes("owned stages"));
});

void test("items rest as a status icon, text and stage badge", async () => {
  await openLeadReport();
  await waitText("Project activities");
  const text = LEAD_FORM_FIXTURE.currentText;
  const current = await weekGroup("Current week", text, PRODUCT);
  const names = buttonNames(current.snapshot);
  // The four controls of an item: the status icon, the editable text, and the
  // two actions that stay in the tree while visually hidden.
  for (const prefix of [
    "Status of ",
    "Edit item: ",
    "Quick move to ",
    "More actions for ",
  ])
    assert.equal(
      names.filter((name) => name.startsWith(prefix)).length,
      1,
      `${prefix}; buttons seen: ${names.join(" | ")}`,
    );
  assert.equal(
    names.filter((name) =>
      /^(?:Update|Plan this work|Confirm|Edit details|Move to)/u.test(name),
    ).length,
    0,
    `Text action buttons at rest: ${names.join(" | ")}`,
  );
  assert.match(current.snapshot, /image "Stages: Development/u);
  assert.equal(
    refsByRole(await snapshot(), "button", /^Update progress/u).length,
    0,
  );
  // Previously planned shows its status as a picture, never as a control.
  const previous = await weekBlock(
    "Previously planned",
    PREVIOUS_TEXT,
    PRODUCT,
  );
  assert.match(
    previous,
    new RegExp(
      `image "Status of ${escapePattern(shortItemLabel(PREVIOUS_TEXT))}: Planned"`,
      "u",
    ),
  );
  assert.ok(
    !buttonNames(previous).some((name) => name.startsWith("Status of ")),
  );
});

void test("item actions are revealed by focus or hover and stay in the accessibility tree", async () => {
  await openLeadReport();
  await waitText("Project activities");
  const opacity = (text: string) => {
    const selector = `button[aria-label="Quick move to next week: ${shortItemLabel(text)}"]`;
    return `getComputedStyle(document.querySelector(${JSON.stringify(selector)}).closest('[data-overview-item-actions]')).opacity`;
  };
  const focused = LEAD_FORM_FIXTURE.currentText;
  const hovered = LEAD_FORM_FIXTURE.carriedText;
  const quickMoveRef = await weekControl(
    "Current week",
    focused,
    "button",
    `Quick move to next week: ${shortItemLabel(focused)}`,
    PRODUCT,
  );
  const titleRef = await weekControl(
    "Current week",
    hovered,
    "button",
    `Edit item: ${hovered}`,
    LEAD_FORM_FIXTURE.carriedProductName,
  );
  for (const text of [focused, hovered])
    assert.equal((await command(["eval", opacity(text)])).result, "0");
  await command(["focus", quickMoveRef]);
  await command(["wait", "--fn", `${opacity(focused)} === "1"`]);
  await command(["hover", titleRef]);
  await command(["wait", "--fn", `${opacity(hovered)} === "1"`]);
});

void test("overview disclosures reveal long updates and additional rows", async () => {
  await openLeadReport();
  for (const text of EXTRA_UPDATES) await addActivity(text);
  await reloadOverview();
  const before = await writeCount();
  const data = await snapshot();
  const article = scopeSnapshot(data, "article", `Activity ${ACTIVITY}`);
  const refs = refsByRole(article, "button", /^\+\d+ more$/);
  assert.equal(
    refs.length,
    1,
    `More updates; names seen: ${roleNames(article, "button")}`,
  );
  const more = refs[0];
  assert.ok(more);
  await command(["click", more]);
  const expand = await namedRef(
    "button",
    `Show full update: ${shortItemLabel(LONG_UPDATE)}`,
  );
  assert.equal(await getAttr(expand, "aria-expanded"), "false");
  await command(["click", expand]);
  const collapse = await namedRef(
    "button",
    `Show less: ${shortItemLabel(LONG_UPDATE)}`,
  );
  assert.equal(await getAttr(collapse, "aria-expanded"), "true");
  assert.ok(
    (await weekBlock("Current week", LONG_UPDATE)).includes(LONG_UPDATE),
  );
  await command(["click", collapse]);
  assert.equal(
    await getAttr(
      await namedRef(
        "button",
        `Show full update: ${shortItemLabel(LONG_UPDATE)}`,
      ),
      "aria-expanded",
    ),
    "false",
  );
  await findRole("button", "Show less", "click");
  const collapsed = await snapshot();
  const scope = scopeSnapshot(collapsed, "article", `Activity ${ACTIVITY}`);
  const moreAfter = refsByRole(scope, "button", /^\+\d+ more$/);
  assert.equal(
    moreAfter.length,
    1,
    `Collapsed updates; names seen: ${roleNames(scope, "button")}`,
  );
  const afterRef = moreAfter[0];
  assert.ok(afterRef);
  assert.equal(await getAttr(afterRef, "aria-expanded"), "false");
  assert.equal(await writeCount(), before);
});

void test("report health is one summary line that expands on demand", async () => {
  await openLeadReport();
  await waitText("Project activities");
  const collapsed = scopeSnapshot(await snapshot(), "region", "Report health");
  assert.equal(scopeCount(collapsed, "DisclosureTriangle", HEALTH_SUMMARY), 1);
  assert.equal(
    refsByRole(collapsed, "button", /^Inspect health for /u).length,
    0,
  );
  await expandHealth();
  const expanded = scopeSnapshot(await snapshot(), "region", "Report health");
  assert.equal(
    refsByRole(expanded, "button", `Inspect health for ${PRODUCT}`).length,
    1,
  );
});

void test("health inspection preserves pending input and restores focus", async () => {
  await openLeadReport();
  await openEditor("Current week", LEAD_FORM_FIXTURE.currentText, PRODUCT);
  const pending = `${LEAD_FORM_FIXTURE.currentText} pending`;
  await fill("Description *", pending);
  const before = await writeCount();
  await expandHealth();
  const pulse = `Inspect health for ${PRODUCT}`;
  const detailLabel = `Health details for ${PRODUCT}`;
  await findRole("button", pulse, "click");
  const detail = await namedBlock("region", detailLabel);
  assert.ok(detail.includes(`All stages for ${PRODUCT}`));
  for (const label of [
    "Development",
    "Testing",
    "DevOps",
    "Support",
    "Cause",
    "Impact",
    "Mitigation",
  ])
    assert.ok(detail.includes(label));
  for (const text of [
    "Риск: внешний API контрагента нестабилен на пике трафика",
    "Влияние: задержка релиза Q2 на одну неделю",
    "Митигация: фолбэк через очередь повтора + эскалация партнёру",
  ])
    assert.ok(detail.includes(text));
  await findRole("button", "Close health details", "click");
  assert.equal(
    (
      await command([
        "eval",
        "document.activeElement?.getAttribute('aria-label')",
      ])
    ).result,
    pulse,
  );
  assert.equal(await value("Description *"), pending);
  await findRole("button", PRODUCT, "click");
  await namedBlock("region", detailLabel);
  await command([
    "wait",
    "--fn",
    `document.activeElement?.getAttribute('aria-label') === ${JSON.stringify(detailLabel)}`,
  ]);
  await command(["press", "Escape"]);
  assert.equal(
    (await command(["eval", "document.activeElement?.textContent?.trim()"]))
      .result,
    PRODUCT,
  );
  assert.equal(await value("Description *"), pending);
  assert.equal(await writeCount(), before);
  await cancelUpdate("Current week", PRODUCT);
  await discardChanges();
  await reloadOverview();
  assert.ok(
    (
      await weekBlock("Current week", LEAD_FORM_FIXTURE.currentText, PRODUCT)
    ).includes(LEAD_FORM_FIXTURE.currentText),
  );
  assert.ok(!(await snapshot()).snapshot.includes(pending));
});

void test("activity health stays stage-free and historical health stays read-only", async () => {
  await openLeadReport();
  const before = await writeCount();
  const product = await roleText("article", `Product ${PRODUCT}`);
  await findRole("button", ACTIVITY, "click");
  const data = await snapshot();
  const detail = scopeSnapshot(
    data,
    "region",
    `Health details for ${ACTIVITY}`,
  );
  assert.ok(
    detail.snapshot.includes(
      "Activity health is independent of linked products.",
    ),
  );
  assert.equal(scopeCount(detail, "list", `All stages for ${ACTIVITY}`), 0);
  await findRole("button", "Close health details", "click");
  assert.equal(await roleText("article", `Product ${PRODUCT}`), product);
  await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await findRole("button", PRODUCT, "click");
  const historical = await namedBlock(
    "region",
    `Health details for ${PRODUCT}`,
  );
  assert.ok(historical.includes("Read-only inspection."));
  assert.doesNotMatch(historical, /- (?:textbox|checkbox|radio|combobox)\b/u);
  await findRole("button", "Close health details", "click");
  assert.equal(await writeCount(), before);
});

void test("the item editor saves current and next week through the canonical form", async () => {
  await openLeadReport();
  for (const week of ["Current week", "Next week"] as const) {
    const text = `E2E canonical ${week} activity`;
    await addActivity(text, week);
    await openEditor(week, text);
    const updated = `${text} updated`;
    await fill("Description *", updated);
    await findRole("button", "In progress", "click");
    await pressSaveShortcut("Description *");
    await waitClosed({ role: "form", name: `${week} update for ${ACTIVITY}` });
    await saveDraft();
    await reloadOverview();
    const stored = await weekBlock(week, updated);
    await assertStatus(week, updated, "In progress");
    assert.equal(stored.includes("Unplanned"), week === "Current week");
    await openEditor(week, updated);
    assert.equal(await value("Description *"), updated);
    await cancelUpdate(week);
    await waitClosed({ role: "form", name: `${week} update for ${ACTIVITY}` });
  }
  await findRole(
    "button",
    `Add item to ${LEAD_FORM_FIXTURE.singleStageProductName}`,
    "click",
  );
  await fill("Description *", "E2E canonical product stages");
  await saveUpdate("Current week", LEAD_FORM_FIXTURE.singleStageProductName);
  await reloadOverview();
  assert.ok(
    (
      await weekBlock(
        "Current week",
        "E2E canonical product stages",
        LEAD_FORM_FIXTURE.singleStageProductName,
      )
    ).includes(LEAD_FORM_FIXTURE.singleStageName),
  );
});

void test("More actions and Quick move edit details and move between current and next week", async () => {
  await openLeadReport();
  const text = "E2E reversible week placement";
  await addActivity(text);
  await moreAction("Current week", text, "Edit details");
  await findRole("radio", "Next week", "click");
  await fill("Description *", `${text} discarded`);
  await command(["press", "Escape"]);
  await discardChanges();
  await reloadOverview();
  assert.ok((await weekBlock("Current week", text)).includes(text));
  await moreAction("Current week", text, "Edit details");
  await findRole("radio", "Next week", "click");
  await namedBlock("form", `Next week update for ${ACTIVITY}`);
  await saveUpdate("Next week");
  await reloadOverview();
  await assertPlacement("Next week", text);
  await moreAction("Next week", text, "Move to this week");
  await saveUpdate("Current week");
  await reloadOverview();
  await assertPlacement("Current week", text);
  await quickMove("Current week", text);
  await waitScope({ role: "form", name: `Next week update for ${ACTIVITY}` });
  await saveUpdate("Next week");
  await reloadOverview();
  await assertPlacement("Next week", text);
  await quickMove("Next week", text);
  await waitScope({
    role: "form",
    name: `Current week update for ${ACTIVITY}`,
  });
  await saveUpdate("Current week");
  await reloadOverview();
  await assertPlacement("Current week", text);
  await moreAction("Current week", text, "Move to next week");
  await saveUpdate("Next week");
  await reloadOverview();
  await assertPlacement("Next week", text);
  assert.equal(await statusButtonCount(text), 1);
});

void test("Edit details changes the parent and persists its owned stage", async () => {
  await openLeadReport();
  const text = "E2E canonical parent placement";
  await addActivity(text);
  await moreAction("Current week", text, "Edit details");
  await findRole("DisclosureTriangle", "Edit details", "click");
  await command([
    "select",
    await namedRef("combobox", "Parent"),
    LEAD_FORM_FIXTURE.singleStageProductName,
  ]);
  const form = await namedBlock(
    "form",
    `Current week update for ${LEAD_FORM_FIXTURE.singleStageProductName}`,
  );
  assert.ok(form.includes("Applied automatically"));
  await saveUpdate("Current week", LEAD_FORM_FIXTURE.singleStageProductName);
  await reloadOverview();
  const row = await weekBlock(
    "Current week",
    text,
    LEAD_FORM_FIXTURE.singleStageProductName,
  );
  assert.ok(row.includes(LEAD_FORM_FIXTURE.singleStageName));
  assert.ok(
    !(await namedBlock("article", `Activity ${ACTIVITY}`)).includes(text),
  );
});

for (const week of ["Current week", "Next week"] as const) {
  for (const status of [
    week === "Current week" ? "Not started" : "Planned",
    ...STATUS_CHOICES,
  ]) {
    void test(`Update status persists ${week} ${status}`, async () => {
      await openLeadReport();
      const text = `E2E ${week} ${status} status`;
      await startActivity(text, week);
      await findRole("button", status, "click");
      if (status === "Paused") {
        await findRole("button", "Save update", "click");
        await waitText("A reason is required to pause an item.");
        await fill("Pause reason *", "E2E waiting on a dependency");
      }
      await saveUpdate(week);
      await reloadOverview();
      await assertStatus(week, text, status);
      await moreAction(week, text, "Edit details");
      assert.equal(
        await getAttr(await namedRef("button", status), "aria-pressed"),
        "true",
      );
      if (status === "Paused")
        assert.equal(
          await value("Pause reason *"),
          "E2E waiting on a dependency",
        );
      await cancelUpdate(week);
      await waitClosed({
        role: "form",
        name: `${week} update for ${ACTIVITY}`,
      });
    });
  }
}

void test("the status icon menu changes status in place and Paused opens the editor", async () => {
  await openLeadReport();
  const text = "E2E status icon menu";
  await addActivity(text);
  await assertStatus("Current week", text, "In progress");
  // A pause needs its reason, so the menu opens the editor instead of patching.
  await chooseStatus("Current week", text, "Paused");
  await waitScope({
    role: "form",
    name: `Current week update for ${ACTIVITY}`,
  });
  assert.equal(await value("Description *"), text);
  await cancelUpdate("Current week");
  await waitClosed({
    role: "form",
    name: `Current week update for ${ACTIVITY}`,
  });
  await assertStatus("Current week", text, "In progress");
  for (const status of ["Not started", "Postponed", "Done"]) {
    await chooseStatus("Current week", text, status);
    await waitStatus("Current week", text, status);
  }
  await saveDraft();
  await reloadOverview();
  await assertStatus("Current week", text, "Done");
  assert.equal(await statusButtonCount(text), 1);
});

void test("leaving Paused clears the saved reason", async () => {
  await openLeadReport();
  const text = "E2E pause reason is cleared";
  await startActivity(text);
  await findRole("button", "Paused", "click");
  await fill("Pause reason *", "E2E reason to clear");
  await saveUpdate("Current week");
  await openEditor("Current week", text);
  await findRole("button", "In progress", "click");
  await saveUpdate("Current week");
  await reloadOverview();
  assert.ok(
    !(await weekBlock("Current week", text)).includes("E2E reason to clear"),
  );
  await openEditor("Current week", text);
  await findRole("button", "Paused", "click");
  assert.equal(await value("Pause reason *"), "");
  await cancelUpdate("Current week");
  await discardChanges();
});

void test("covering risk locks canonical item status", async () => {
  await openLeadReport();
  // A covering risk owns the status: the icon menu cannot patch it in place and
  // opens the canonical editor on the same item instead.
  await chooseStatus(
    "Current week",
    LEAD_FORM_FIXTURE.currentText,
    "Done",
    PRODUCT,
  );
  await waitScope({
    role: "form",
    name: `Current week update for ${PRODUCT}`,
  });
  const data = await snapshot();
  const form = scopeSnapshot(
    data,
    "form",
    `Current week update for ${PRODUCT}`,
  );
  assert.ok(
    form.snapshot.includes(
      "Status is set by the covering risk/blocker — resolve it in Risks & Blockers to change.",
    ),
  );
  assert.equal(scopeCount(form, "group", "Status"), 0);
  await cancelUpdate("Current week", PRODUCT);
  await waitClosed({
    role: "form",
    name: `Current week update for ${PRODUCT}`,
  });
  await assertStatus(
    "Current week",
    LEAD_FORM_FIXTURE.currentText,
    "In progress",
    PRODUCT,
  );
});

void test("Resolve plan records Done immediately with retained audit", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const text = "E2E terminal completed result";
  await addActivity(text);
  await moreAction("Current week", text, "Update status");
  await findRole("button", "Done", "click");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  await assertStatus("Current week", text, "Done");
  await findRole("DisclosureTriangle", "History · 1", "click");
  assert.ok(
    (await weekBlock("Current week", text)).includes(
      `Completed by ${LEAD_FORM_FIXTURE.leadName}`,
    ),
  );
  assert.equal(await historyText(LEAD_FORM_FIXTURE.previousReportId), previous);
});

void test("Resolve plan completes a Next plan in Current with retained audit", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const text = "E2E completed next-period plan";
  await addActivity(text, "Next week");
  await moreAction("Next week", text, "Update status");
  await findRole("button", "Done", "click");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  await assertPlacement("Current week", text);
  await assertStatus("Current week", text, "Done");
  await findRole("DisclosureTriangle", "History · 1", "click");
  assert.ok(
    (await weekBlock("Current week", text)).includes(
      `Completed by ${LEAD_FORM_FIXTURE.leadName}`,
    ),
  );
  assert.equal(await historyText(LEAD_FORM_FIXTURE.previousReportId), previous);
});

for (const week of ["Current week", "Next week"] as const) {
  void test(`Resolve plan records Won't do and Restore preserves audit in ${week}`, async () => {
    await openLeadReport();
    const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
    await openLeadReport();
    const text = `E2E terminal ${week} cancelled plan`;
    await addActivity(text, week);
    await moreAction(week, text, "Update status");
    const before = await writeCount();
    await command([
      "click",
      await namedRef("button", "Cancel", {
        role: "form",
        name: "Resolve plan",
      }),
    ]);
    await waitClosed({ role: "form", name: "Resolve plan" });
    assert.equal(await writeCount(), before);
    await moreAction(week, text, "Update status");
    await findRole("button", "Won't do", "click");
    await findRole("button", "Save outcome", "click");
    await waitText("Explain why this plan will not be done.");
    await fill("Why won't this be done?", "E2E superseded requirement");
    await findRole("button", "Save outcome", "click");
    await waitClosed({ role: "form", name: "Resolve plan" });
    await reloadOverview();
    await assertStatus(week, text, "Won't do");
    assert.ok(
      (await weekBlock(week, text)).includes(
        "Won't do · E2E superseded requirement",
      ),
    );
    await revealClick(
      await weekControl(
        week,
        text,
        "button",
        `Restore ${shortItemLabel(text)}`,
      ),
    );
    await waitText("Plan restored");
    await waitClosed({ role: "form", name: "Restore plan" });
    await reloadOverview();
    assert.equal(
      refsByRole(await snapshot(), "button", `Restore ${shortItemLabel(text)}`)
        .length,
      0,
    );
    await findRole("DisclosureTriangle", "History · 2", "click");
    const row = await weekBlock(week, text);
    assert.ok(row.includes(`Marked Won't do by ${LEAD_FORM_FIXTURE.leadName}`));
    assert.ok(row.includes("E2E superseded requirement"));
    assert.ok(row.includes(`Restored plan by ${LEAD_FORM_FIXTURE.leadName}`));
    assert.equal(
      await historyText(LEAD_FORM_FIXTURE.previousReportId),
      previous,
    );
  });
}

const RECOVERY_CASES = [
  [OPEN_WORK_FIXTURE.paused, "Resume paused work", "Continue"],
  [OPEN_WORK_FIXTURE.automaticPaused, "Resume paused work", "Continue"],
  [OPEN_WORK_FIXTURE.continue, "Continue work", "Continue"],
  [OPEN_WORK_FIXTURE.deferred, "Replan deferred work", "Plan next"],
  [OPEN_WORK_FIXTURE.planned, "Plan this work", "Plan next"],
] as const;

void test("open work Done records the changed result and readable prior text", async () => {
  await openLeadReport();
  const previous = await historyText(OPEN_WORK_FIXTURE.archiveReportId);
  await openLeadReport();
  await openWorkOutcome(OPEN_WORK_FIXTURE.continue, "Continue work");
  await fill("This period's update", "E2E finished recovered historical work");
  await findRole("button", "Done", "click");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  await assertStatus(
    "Current week",
    "E2E finished recovered historical work",
    "Done",
  );
  await findRole("DisclosureTriangle", "History · 1", "click");
  const current = await weekBlock(
    "Current week",
    "E2E finished recovered historical work",
  );
  assert.ok(current.includes(`Previous: ${OPEN_WORK_FIXTURE.continue}`));
  assert.ok(current.includes(`Completed by ${LEAD_FORM_FIXTURE.leadName}`));
  assert.equal(await historyText(OPEN_WORK_FIXTURE.archiveReportId), previous);
});

for (const [text, action, outcome] of RECOVERY_CASES) {
  void test(`open work ${text} ${action} creates a ${outcome} commitment without changing history`, async () => {
    await openLeadReport();
    const previous = await historyText(OPEN_WORK_FIXTURE.archiveReportId);
    await openLeadReport();
    await waitOpenWork();
    assert.ok((await openWorkRow(text)).snapshot.includes(action));
    await recoverWork(text, action, outcome);
    assert.equal(
      await historyText(OPEN_WORK_FIXTURE.archiveReportId),
      previous,
    );
  });
}

for (const text of [OPEN_WORK_FIXTURE.completed, OPEN_WORK_FIXTURE.cancelled]) {
  void test(`Reopen in this report restores ${text} without changing history`, async () => {
    await openLeadReport();
    const previous = await historyText(OPEN_WORK_FIXTURE.archiveReportId);
    await openLeadReport();
    await expandOpenWork();
    const observed = await snapshot();
    assert.equal(
      scopeCount(observed, "DisclosureTriangle", TERMINAL_SUMMARY),
      1,
      `Terminal work; names seen: ${roleNames(observed, "DisclosureTriangle")}`,
    );
    await recoverWork(text, "Reopen in this report", "Plan next");
    assert.equal(
      await historyText(OPEN_WORK_FIXTURE.archiveReportId),
      previous,
    );
  });
}

void test("Previous remains read-only", async () => {
  await openLeadReport();
  const before = await writeCount();
  const previous = await weekBlock(
    "Previously planned",
    PREVIOUS_TEXT,
    PRODUCT,
  );
  assert.ok(previous.includes(PREVIOUS_TEXT));
  // No control edits, moves or sets the status of the prior-week occurrence:
  // only the verdict rail and the historical replan act, on the selected week.
  assert.doesNotMatch(
    previous,
    /(?:button|menuitem) "(?:Edit item:|Status of |Quick move|Edit details|Update status:|Move to|Restore )/u,
  );
  assert.match(previous, /image "Status of /u);
  assert.equal(
    buttonNames(previous).filter(
      (name) =>
        !/^(?:Done|Continue|Next week|Paused) — |^More actions for |^Plan this work: /u.test(
          name,
        ),
    ).length,
    0,
    `Previous buttons: ${buttonNames(previous).join(" | ")}`,
  );
  await reloadOverview();
  assert.ok(
    (await weekBlock("Previously planned", PREVIOUS_TEXT, PRODUCT)).includes(
      PREVIOUS_TEXT,
    ),
  );
  assert.equal(await writeCount(), before);
});

async function verdictControl(role: string, name: string): Promise<string> {
  return weekControl("Previously planned", PREVIOUS_TEXT, role, name, PRODUCT);
}

async function waitVerdict(label: string): Promise<void> {
  await waitSnapshot(
    (data) =>
      weekGroups(data, "Previously planned", PREVIOUS_TEXT, PRODUCT).some(
        (group) => group.snapshot.includes(`image "Verdict: ${label}"`),
      ),
    `Expected the ${label} verdict stamp`,
  );
}

// A verdict leaves the prior row as text plus a stamp: no rail is left to press.
async function assertDecided(label: string): Promise<void> {
  await waitVerdict(label);
  const decided = await weekBlock("Previously planned", PREVIOUS_TEXT, PRODUCT);
  assert.ok(decided.includes(PREVIOUS_TEXT));
  assert.ok(!decided.includes("Verdict for "));
  assert.equal(
    buttonNames(decided).filter((name) =>
      /^(?:Done|Continue|Next week|Paused) — /u.test(name),
    ).length,
    0,
  );
}

async function waitVerdictReason(label: string): Promise<void> {
  const name = `${label} reason — ${PREVIOUS_TEXT}`;
  await waitSnapshot(
    (data) =>
      weekGroups(data, "Previously planned", PREVIOUS_TEXT, PRODUCT).some(
        (group) => refsByRole(group, "textbox", name).length === 1,
      ),
    `Expected the ${label} reason field`,
  );
}

async function fillVerdictReason(label: string, reason: string) {
  await waitVerdictReason(label);
  await command([
    "fill",
    await verdictControl("textbox", `${label} reason — ${PREVIOUS_TEXT}`),
    reason,
  ]);
  await command(["click", await verdictControl("button", "Save")]);
}

void test("Previously planned offers one verdict per item, with Won't do in the overflow", async () => {
  await openLeadReport();
  const previous = await weekGroup(
    "Previously planned",
    PREVIOUS_TEXT,
    PRODUCT,
  );
  const rail = scopeSnapshot(previous, "group", `Verdict for ${PREVIOUS_TEXT}`);
  for (const verdict of ["Done", "Continue", "Next week", "Paused"])
    assert.equal(
      scopeCount(rail, "button", `${verdict} — ${PREVIOUS_TEXT}`),
      1,
      `${verdict}; names seen: ${roleNames(rail, "button")}`,
    );
  assert.equal(
    scopeCount(rail, "button", `More actions for ${PREVIOUS_TEXT}`),
    1,
  );
  await command([
    "click",
    await verdictControl("button", `More actions for ${PREVIOUS_TEXT}`),
  ]);
  assert.equal(
    scopeCount(await snapshot(), "menuitem", `Won't do — ${PREVIOUS_TEXT}`),
    1,
  );
  await command(["press", "Escape"]);
});

for (const [verdict, column, status] of [
  ["Done", "Current week", "Done"],
  ["Continue", "Current week", "In progress"],
  ["Next week", "Next week", "Planned"],
] as const) {
  void test(`Previously planned ${verdict} verdict writes ${column} ${status} and leaves the prior week unchanged`, async () => {
    await openLeadReport();
    const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
    await openLeadReport();
    await command([
      "click",
      await verdictControl("button", `${verdict} — ${PREVIOUS_TEXT}`),
    ]);
    await assertDecided(verdict);
    await assertStatus(column, PREVIOUS_TEXT, status, PRODUCT);
    await reloadOverview();
    await assertDecided(verdict);
    await assertStatus(column, PREVIOUS_TEXT, status, PRODUCT);
    assert.equal(await statusButtonCount(PREVIOUS_TEXT), 1);
    assert.equal(
      await historyText(LEAD_FORM_FIXTURE.previousReportId),
      previous,
    );
  });
}

void test("Previously planned Paused verdict needs a reason and writes the selected week as paused", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const reason = "E2E verdict pause reason";
  await command([
    "click",
    await verdictControl("button", `Paused — ${PREVIOUS_TEXT}`),
  ]);
  await waitVerdictReason("Paused");
  const before = await writeCount("leadForm.resolvePlan");
  await command(["click", await verdictControl("button", "Save")]);
  await waitText("Add a one-line reason.");
  assert.equal(await writeCount("leadForm.resolvePlan"), before);
  await fillVerdictReason("Paused", reason);
  await assertDecided("Paused");
  await assertStatus("Current week", PREVIOUS_TEXT, "Paused", PRODUCT);
  await saveDraft();
  await reloadOverview();
  await assertDecided("Paused");
  await assertStatus("Current week", PREVIOUS_TEXT, "Paused", PRODUCT);
  await openEditor("Current week", PREVIOUS_TEXT, PRODUCT);
  assert.equal(await value("Pause reason *"), reason);
  await cancelUpdate("Current week", PRODUCT);
  await waitClosed({
    role: "form",
    name: `Current week update for ${PRODUCT}`,
  });
  assert.equal(await historyText(LEAD_FORM_FIXTURE.previousReportId), previous);
});

void test("Previously planned Won't do verdict keeps its reason and leaves the prior week unchanged", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const reason = "E2E verdict won't do reason";
  await command([
    "click",
    await verdictControl("button", `More actions for ${PREVIOUS_TEXT}`),
  ]);
  await findRole("menuitem", `Won't do — ${PREVIOUS_TEXT}`, "click");
  await fillVerdictReason("Won't do", reason);
  await assertDecided("Won't do");
  await reloadOverview();
  await assertDecided("Won't do");
  assert.ok(
    (await namedBlock("article", `Product ${PRODUCT}`)).includes(
      `Won't do · ${reason}`,
    ),
  );
  assert.equal(await historyText(LEAD_FORM_FIXTURE.previousReportId), previous);
});

void test("earlier open work is one collapsed line that expands to its items", async () => {
  await openLeadReport();
  await waitOpenWork();
  const collapsed = scopeSnapshot(await snapshot(), "region", REGISTER_NAME);
  assert.equal(
    scopeCount(collapsed, "DisclosureTriangle", OPEN_ITEMS_SUMMARY),
    1,
  );
  assert.equal(scopeCount(collapsed, "listitem"), 0);
  assert.equal(scopeCount(await snapshot(), "heading", REGISTER_NAME), 0);
  for (const [text] of RECOVERY_CASES)
    assert.ok(!collapsed.snapshot.includes(text), text);
  for (const [text, action] of RECOVERY_CASES)
    assert.ok((await openWorkRow(text)).snapshot.includes(action), text);
});

void test("Previous historical replan creates active work without changing its plan", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const text = LEAD_FORM_FIXTURE.previousText;
  await revealClick(
    await weekControl(
      "Previously planned",
      text,
      "button",
      `Plan this work: ${shortItemLabel(text)}`,
      PRODUCT,
    ),
  );
  await namedBlock("form", `Current week update for ${PRODUCT}`);
  await fill("Description *", "E2E explicitly replanned prior work");
  await saveUpdate("Current week", PRODUCT);
  await reloadOverview();
  assert.ok(
    (await weekBlock("Previously planned", text, PRODUCT)).includes(text),
  );
  assert.ok(
    (
      await weekBlock(
        "Current week",
        "E2E explicitly replanned prior work",
        PRODUCT,
      )
    ).includes("E2E explicitly replanned prior work"),
  );
  assert.equal(
    refsByRole(
      await snapshot(),
      "button",
      `Plan this work: ${shortItemLabel(text)}`,
    ).length,
    0,
  );
  assert.equal(await historyText(LEAD_FORM_FIXTURE.previousReportId), previous);
});

const CARRIED_MARKER = "not updated this week";

void test("carried work confirms through the status icon without duplicate continuation", async () => {
  await openLeadReport();
  const parent = LEAD_FORM_FIXTURE.carriedProductName;
  const text = LEAD_FORM_FIXTURE.carriedText;
  await assertStatus(
    "Next week",
    LEAD_FORM_FIXTURE.explicitNextText,
    "Planned",
    parent,
  );
  assert.ok(
    (await weekBlock("Current week", text, parent)).includes(CARRIED_MARKER),
  );
  // Choosing the status the carried item already shows is the confirmation.
  await chooseStatus("Current week", text, "In progress", parent);
  await waitSnapshot(
    (data) =>
      weekGroups(data, "Current week", text, parent).every(
        (group) => !group.snapshot.includes(CARRIED_MARKER),
      ),
    "Expected the carried marker to clear",
  );
  await saveDraft();
  await reloadOverview();
  await assertStatus("Current week", text, "In progress", parent);
  assert.ok(
    !(await weekBlock("Current week", text, parent)).includes(CARRIED_MARKER),
  );
  assert.equal(await statusButtonCount(text), 1);
  await assertStatus(
    "Next week",
    LEAD_FORM_FIXTURE.explicitNextText,
    "Planned",
    parent,
  );
  assert.equal(await statusButtonCount(LEAD_FORM_FIXTURE.explicitNextText), 1);
});

void test("carried work still confirms when its editor is saved", async () => {
  await openLeadReport();
  const parent = LEAD_FORM_FIXTURE.carriedProductName;
  const text = LEAD_FORM_FIXTURE.carriedText;
  await openEditor("Current week", text, parent);
  await saveUpdate("Current week", parent);
  await reloadOverview();
  assert.ok(
    !(await weekBlock("Current week", text, parent)).includes(CARRIED_MARKER),
  );
  assert.equal(await statusButtonCount(text), 1);
});

void test("Confirm all as continue confirms every suggested continuation in one action", async () => {
  await openLeadReport();
  const parent = LEAD_FORM_FIXTURE.carriedProductName;
  const text = LEAD_FORM_FIXTURE.carriedText;
  const pending = (data: BrowserSnapshot) =>
    scopeCount(data, "StaticText", /^\d+ to review$/u);
  assert.ok(
    (await weekBlock("Current week", text, parent)).includes(CARRIED_MARKER),
  );
  assert.ok(pending(await snapshot()) > 0);
  await findRole("button", "Confirm all as continue", "click");
  await waitSnapshot(
    (data) =>
      pending(data) === 0 &&
      refsByRole(data, "button", "Confirm all as continue").length === 0,
    "Expected no pending review after Confirm all as continue",
  );
  await saveDraft();
  await reloadOverview();
  assert.equal(pending(await snapshot()), 0);
  assert.equal(
    refsByRole(await snapshot(), "button", "Confirm all as continue").length,
    0,
  );
  await assertStatus("Current week", text, "In progress", parent);
  assert.equal(await statusButtonCount(text), 1);
  await assertStatus(
    "Next week",
    LEAD_FORM_FIXTURE.explicitNextText,
    "Planned",
    parent,
  );
});

for (const week of ["Current week", "Next week"] as const) {
  void test(`moving the explicit commitment to ${week} retains its previous result`, async () => {
    await openLeadReport();
    const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
    await openLeadReport();
    const parent = LEAD_FORM_FIXTURE.carriedProductName;
    await openEditor("Current week", LEAD_FORM_FIXTURE.carriedText, parent);
    await saveUpdate("Current week", parent);
    const sourceText =
      week === "Current week"
        ? LEAD_FORM_FIXTURE.explicitNextText
        : LEAD_FORM_FIXTURE.carriedText;
    await moreAction(
      week === "Current week" ? "Next week" : "Current week",
      sourceText,
      week === "Current week" ? "Move to this week" : "Move to next week",
      parent,
    );
    const form = await namedBlock("form", `${week} update for ${parent}`);
    assert.ok(form.includes("No changes are made until you save."));
    await saveUpdate(week, parent);
    await reloadOverview();
    await weekBlock(week, LEAD_FORM_FIXTURE.explicitNextText, parent);
    const article = await namedBlock("article", `Product ${parent}`);
    const otherWeek = week === "Current week" ? "Next week" : "Current week";
    assert.equal(
      columnBlocks(article, otherWeek).filter((group) =>
        group.includes(LEAD_FORM_FIXTURE.explicitNextText),
      ).length,
      0,
    );
    assert.equal(
      await statusButtonCount(LEAD_FORM_FIXTURE.explicitNextText),
      1,
    );
    await findRole("DisclosureTriangle", "History · 1", "click");
    const row = await weekBlock(
      week,
      LEAD_FORM_FIXTURE.explicitNextText,
      parent,
    );
    assert.ok(row.includes(`Previous: ${LEAD_FORM_FIXTURE.carriedText}`));
    assert.ok(row.includes(LEAD_FORM_FIXTURE.leadName));
    assert.equal(
      await historyText(LEAD_FORM_FIXTURE.previousReportId),
      previous,
    );
  });
}

void test("own reviewer record feedback is readable without a Lead comment editor", async () => {
  await openLeadReport();
  const row = await weekBlock(
    "Current week",
    LEAD_FORM_FIXTURE.currentText,
    PRODUCT,
  );
  assert.ok(row.includes("Reviewer comments"));
  assert.ok(row.includes(LEAD_FORM_FIXTURE.ownReviewComment));
  const article = scopeSnapshot(
    await snapshot(),
    "article",
    `Product ${PRODUCT}`,
  );
  const matches = scopeSnapshots(article, "group", /^CURRENT WEEK/u).filter(
    (group) => group.snapshot.includes(LEAD_FORM_FIXTURE.currentText),
  );
  assert.equal(matches.length, 1);
  const current = matches[0];
  assert.ok(current);
  assert.equal(refsByRole(current, "textbox", /comment/i).length, 0);
  assert.equal(
    refsByRole(current, "button", /(?:Add|Save|Edit|Delete) comment/i).length,
    0,
  );
});

void test("Parent and stages retains pending outcome details and saves the chosen product", async () => {
  await openLeadReport();
  const previous = await historyText(OPEN_WORK_FIXTURE.archiveReportId);
  await openLeadReport();
  await waitOpenWork();
  const before = await writeCount();
  await openWorkOutcome(OPEN_WORK_FIXTURE.continue, "Continue work");
  await findRole("button", "Continue", "click");
  await waitText("Parent and stages");
  const initial = scopeSnapshot(await snapshot(), "form", "Resolve plan");
  assert.equal(refsByRole(initial, "combobox", "Parent").length, 0);
  const result = "E2E recovered work with retained outcome details";
  const nextStep = "E2E optional next commitment from the outcome composer";
  await fill("This period's update", result);
  await fill("Next step (optional)", nextStep);
  await findRole("DisclosureTriangle", "Parent and stages", "click");
  await command(["select", await namedRef("combobox", "Parent"), PRODUCT]);
  await waitText("SDLC Stages");
  await findRole("checkbox", "Development", "click");
  assert.equal(await stageChecked("Development"), true);
  const chosenParent = await selectedParent();
  assert.match(chosenParent, /^product:/u);
  await findRole("DisclosureTriangle", "Parent and stages", "click");
  const closed = scopeSnapshot(await snapshot(), "form", "Resolve plan");
  assert.equal(refsByRole(closed, "checkbox", "Development").length, 0);
  assert.equal(refsByRole(closed, "combobox", "Parent").length, 0);
  assert.equal(await value("This period's update"), result);
  assert.equal(await value("Next step (optional)"), nextStep);
  await findRole("DisclosureTriangle", "Parent and stages", "click");
  await waitText("SDLC Stages");
  assert.equal(await stageChecked("Development"), true);
  assert.equal(await selectedParent(), chosenParent);
  assert.equal(await value("This period's update"), result);
  assert.equal(await value("Next step (optional)"), nextStep);
  assert.equal(await writeCount(), before);
  await findRole("button", "Save outcome", "click");
  await waitText("Plan outcome saved");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  const active = await weekBlock("Current week", result, PRODUCT);
  assert.ok(active.includes("Development"));
  await assertStatus("Current week", result, "In progress", PRODUCT);
  await assertStatus("Next week", nextStep, "Planned", PRODUCT);
  assert.equal(await statusButtonCount(nextStep), 1);
  await openEditor("Current week", result, PRODUCT);
  assert.equal(await stageChecked("Development"), true);
  assert.equal(await value("Description *"), result);
  await cancelUpdate("Current week", PRODUCT);
  await waitClosed({
    role: "form",
    name: `Current week update for ${PRODUCT}`,
  });
  await assertNotInRegister(OPEN_WORK_FIXTURE.continue);
  assert.equal(await historyText(OPEN_WORK_FIXTURE.archiveReportId), previous);
});

void test("outcome and restore failures retain inputs and retry with audit", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const text = "E2E outcome transport retries preserve lineage";
  const reason = "E2E cancellation input retained after a transport failure";
  await addActivity(text);
  await moreAction("Current week", text, "Update status");
  await findRole("button", "Won't do", "click");
  await fill("Why won't this be done?", reason);
  const resolveRoute = "**/trpc/*leadForm.resolvePlan*";
  await command(["network", "route", resolveRoute, "--abort"]);
  try {
    await findRole("button", "Save outcome", "click");
    assert.ok((await waitPlanFailure("Resolve plan")).includes(text));
    assert.equal(await value("Why won't this be done?"), reason);
    const unresolved = await weekBlock("Current week", text);
    await assertStatus("Current week", text, "In progress");
    assert.ok(!unresolved.includes("Won't do"));
    assert.doesNotMatch(unresolved, /DisclosureTriangle "History/u);
  } finally {
    await command(["network", "unroute", resolveRoute]);
  }
  await findRole("button", "Save outcome", "click");
  await waitText("Plan outcome saved");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  assert.ok(
    (await weekBlock("Current week", text)).includes(`Won't do · ${reason}`),
  );
  const restoreRoute = "**/trpc/*leadForm.restorePlan*";
  await command(["network", "route", restoreRoute, "--abort"]);
  try {
    await revealClick(
      await weekControl(
        "Current week",
        text,
        "button",
        `Restore ${shortItemLabel(text)}`,
      ),
    );
    const retained = await waitPlanFailure("Restore plan");
    assert.ok(retained.includes(text));
    assert.ok(retained.includes("The audit history is retained."));
    assert.ok(
      (await weekBlock("Current week", text)).includes(`Won't do · ${reason}`),
    );
    assert.equal(
      scopeCount(await snapshot(), "DisclosureTriangle", "History · 1"),
      1,
    );
  } finally {
    await command(["network", "unroute", restoreRoute]);
  }
  await findRole("button", "Restore plan", "click");
  await waitText("Plan restored");
  await waitClosed({ role: "form", name: "Restore plan" });
  await reloadOverview();
  assert.equal(await statusButtonCount(text), 1);
  await findRole("DisclosureTriangle", "History · 2", "click");
  const restored = await weekBlock("Current week", text);
  assert.ok(
    restored.includes(`Marked Won't do by ${LEAD_FORM_FIXTURE.leadName}`),
  );
  assert.ok(restored.includes(reason));
  assert.ok(
    restored.includes(`Restored plan by ${LEAD_FORM_FIXTURE.leadName}`),
  );
  await assertStatus("Current week", text, "In progress");
  assert.equal(await historyText(LEAD_FORM_FIXTURE.previousReportId), previous);
});

void test("Continue outcome limits preserve a result and optional next step of 500 characters", async () => {
  await openLeadReport();
  const previous = await historyText(OPEN_WORK_FIXTURE.archiveReportId);
  await openLeadReport();
  await openWorkOutcome(OPEN_WORK_FIXTURE.continue, "Continue work");
  await findRole("button", "Continue", "click");
  const result = await fillOutcomeBoundary(
    "This period's update",
    "E2E current outcome boundary ",
  );
  const nextStep = await fillOutcomeBoundary(
    "Next step (optional)",
    "E2E optional next boundary ",
  );
  await pressSaveShortcut("This period's update");
  await waitText("Plan outcome saved");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  await weekBlock("Next week", nextStep);
  await findRole(
    "button",
    `Show full update: ${shortItemLabel(nextStep)}`,
    "click",
  );
  assert.equal(
    await getAttr(
      await namedRef("button", `Show less: ${shortItemLabel(nextStep)}`),
      "aria-expanded",
    ),
    "true",
  );
  const next = await weekBlock("Next week", nextStep);
  assert.ok(next.includes(nextStep));
  await assertStatus("Next week", nextStep, "Planned");
  assert.equal(await statusButtonCount(nextStep), 1);
  await openEditor("Current week", result);
  assert.equal(await value("Description *"), result);
  await cancelUpdate("Current week");
  await waitClosed({
    role: "form",
    name: `Current week update for ${ACTIVITY}`,
  });
  assert.equal(await historyText(OPEN_WORK_FIXTURE.archiveReportId), previous);
});

void test("Plan next outcome limit preserves a commitment of 500 characters", async () => {
  await openLeadReport();
  const previous = await historyText(OPEN_WORK_FIXTURE.archiveReportId);
  await openLeadReport();
  await openWorkOutcome(OPEN_WORK_FIXTURE.planned, "Plan this work");
  await findRole("button", "Plan next", "click");
  const commitment = await fillOutcomeBoundary(
    "Next-period commitment",
    "E2E next outcome boundary ",
  );
  await findRole("button", "Save outcome", "click");
  await waitText("Plan outcome saved");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  await assertStatus("Next week", commitment, "Planned");
  await openEditor("Next week", commitment);
  assert.equal(await value("Description *"), commitment);
  await cancelUpdate("Next week");
  await waitClosed({ role: "form", name: `Next week update for ${ACTIVITY}` });
  assert.equal(await historyText(OPEN_WORK_FIXTURE.archiveReportId), previous);
});

void test("Won't do outcome limit preserves a reason of 500 characters in history", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const text = "E2E cancellation boundary target";
  await addActivity(text);
  await moreAction("Current week", text, "Update status");
  await findRole("button", "Won't do", "click");
  const reason = await fillOutcomeBoundary(
    "Why won't this be done?",
    "E2E cancellation reason boundary ",
  );
  await findRole("button", "Save outcome", "click");
  await waitText("Plan outcome saved");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  assert.ok(
    (await weekBlock("Current week", text)).includes(`Won't do · ${reason}`),
  );
  await findRole("DisclosureTriangle", "History · 1", "click");
  const cancelled = await weekBlock("Current week", text);
  assert.ok(cancelled.includes(reason));
  assert.ok(
    cancelled.includes(`Marked Won't do by ${LEAD_FORM_FIXTURE.leadName}`),
  );
  assert.equal(await historyText(LEAD_FORM_FIXTURE.previousReportId), previous);
});

void test("historical plan item limit retains input without changing saved work", async (context) => {
  await prepareE2eData("demo", context.signal, "section-item-limit");
  await openLeadReport();
  const previous = await historyText(OPEN_WORK_FIXTURE.archiveReportId);
  await openLeadReport();
  await expandOpenWork();
  const savedData = await roleText("region", "Status overview");
  const savedWork = await roleText("region", REGISTER_NAME);
  await openWorkOutcome(OPEN_WORK_FIXTURE.continue, "Continue work");
  await findRole("button", "Continue", "click");
  const result = "E2E item limit keeps this historical result unsaved";
  const nextStep = "E2E item limit keeps this next commitment unsaved";
  await fill("This period's update", result);
  await fill("Next step (optional)", nextStep);
  const scope = { role: "form", name: "Resolve plan" };
  const before = await writeCount("leadForm.resolvePlan");
  for (const attempt of [1, 2]) {
    await command(["click", await namedRef("button", "Save outcome", scope)]);
    await waitText(ITEM_LIMIT_MESSAGE);
    await waitText("Save outcome");
    const form = scopeSnapshot(await snapshot(), scope.role, scope.name);
    const alert = scopeSnapshot(form, "alert");
    assert.equal(scopeCount(alert, "StaticText", ITEM_LIMIT_MESSAGE), 1);
    assert.equal(await value("This period's update"), result);
    assert.equal(await value("Next step (optional)"), nextStep);
    assert.equal(await writeCount("leadForm.resolvePlan"), before + attempt);
    assert.equal(
      await getAttr(
        await namedRef("button", "Save outcome", scope),
        "disabled",
      ),
      null,
    );
  }
  await command(["click", await namedRef("button", "Cancel", scope)]);
  await waitClosed(scope);
  await reloadOverview();
  await expandOpenWork();
  const reloaded = await roleText("region", "Status overview");
  assert.equal(reloaded, savedData);
  assert.ok(!reloaded.includes(result));
  assert.ok(!reloaded.includes(nextStep));
  assert.equal(await roleText("region", REGISTER_NAME), savedWork);
  assert.ok(
    (await openWorkRow(OPEN_WORK_FIXTURE.continue)).snapshot.includes(
      "Continue work",
    ),
  );
  assert.equal(await writeCount("leadForm.resolvePlan"), before + 2);
  assert.equal(await historyText(OPEN_WORK_FIXTURE.archiveReportId), previous);
});
