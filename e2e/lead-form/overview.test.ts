import assert from "node:assert/strict";
import { test } from "node:test";

import { shortItemLabel } from "../../apps/web/src/shared/lib/format/short-label.js";
import { prepareE2eData } from "../setup/reset.js";
import { openLeadReport } from "./access.js";
import {
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
} from "./helpers.js";

registerE2eHooks();

type Week = "Current week" | "Next week";

const ACTIVITY = LEAD_FORM_FIXTURE.activityName;
const PRODUCT = LEAD_FORM_FIXTURE.productName;
const LONG_UPDATE =
  "E2E long activity update verifies that the complete description remains available after collapsing and expanding the overview preview without writing data";
const EXTRA_UPDATES = [
  LONG_UPDATE,
  "E2E additional activity update alpha",
  "E2E additional activity update beta",
] as const;
const STATUS_CHOICES = ["In progress", "Paused", "Postponed", "Done"] as const;
const ITEM_LIMIT_MESSAGE = "This section has reached its item limit.";

async function namedBlock(role: string, name: string): Promise<string> {
  return scopeSnapshot(await snapshot(), role, name).snapshot;
}

function roleNames(data: Awaited<ReturnType<typeof snapshot>>, role: string) {
  return JSON.stringify(
    scopeSnapshots(data, role).map((scope) => scope.snapshot.split("\n")[0]),
  );
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

async function weekBlock(
  week: Week | "Previously planned",
  text: string,
  parent: string = ACTIVITY,
): Promise<string> {
  const kind = parent === ACTIVITY ? "Activity" : "Product";
  await expandUnit(parent, kind);
  const article = await namedBlock("article", `${kind} ${parent}`);
  const groups = columnBlocks(article, week);
  const matching = groups.filter((group) => group.includes(text));
  assert.equal(matching.length, 1, `${week}: ${text}`);
  const group = matching[0];
  assert.ok(group);
  return group;
}

function columnBlocks(article: string, week: Week | "Previously planned") {
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

async function openProgress(
  text: string,
  week: Week,
  parent: string = ACTIVITY,
) {
  await weekBlock(week, text, parent);
  await findRole(
    "button",
    `Update progress for ${shortItemLabel(text)}`,
    "click",
  );
  await namedBlock("form", `${week} update for ${parent}`);
}

async function moreAction(text: string, action: string): Promise<void> {
  await findRole(
    "DisclosureTriangle",
    `More actions for ${shortItemLabel(text)}`,
    "click",
  );
  await findRole("button", action, "click");
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

async function waitOpenWork(): Promise<void> {
  await waitText("Completed and cancelled work");
  await command([
    "wait",
    "--fn",
    "Array.from(document.getElementsByTagName('section')).some(section => section.getAttribute('aria-busy') === 'false' && Array.from(section.getElementsByTagName('h2')).some(heading => heading.textContent?.trim() === 'Open work from earlier periods'))",
  ]);
}

async function openWorkRow(text: string) {
  const register = scopeSnapshot(
    await snapshot(),
    "region",
    "Open work from earlier periods",
  );
  const matches = scopeSnapshots(register, "listitem").filter((row) =>
    row.snapshot.includes(text),
  );
  assert.equal(matches.length, 1, `Open work: ${text}`);
  const row = matches[0];
  assert.ok(row);
  return row;
}

async function openWorkOutcome(text: string, action: string): Promise<void> {
  await waitOpenWork();
  const row = await openWorkRow(text);
  const refs = refsByRole(row, "button", action);
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
  const row = await openWorkRow(text);
  const refs = refsByRole(row, "button", action);
  assert.equal(
    refs.length,
    1,
    `${action}; names seen: ${roleNames(row, "button")}`,
  );
  const ref = refs[0];
  assert.ok(ref);
  await command(["click", ref]);
  await findRole("button", outcome, "click");
  const recovered = `${text} recovered`;
  await fill(
    outcome === "Continue" ? "This period's update" : "Next-period commitment",
    recovered,
  );
  await findRole("button", "Save outcome", "click");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  await waitOpenWork();
  assert.ok(
    !(await namedBlock("region", "Open work from earlier periods")).includes(
      text,
    ),
  );
  const active = await weekBlock(
    outcome === "Continue" ? "Current week" : "Next week",
    recovered,
  );
  assert.ok(active.includes(recovered));
  assert.ok(
    active.includes(outcome === "Continue" ? "In progress" : "Planned"),
  );
}

void test("Overview shows product and activity lineage in all three weeks", async () => {
  await openLeadReport();
  await waitText("PROJECT ACTIVITIES");
  const headings = await snapshot();
  assert.equal(scopeCount(headings, "heading", "PRODUCTS"), 1);
  assert.equal(scopeCount(headings, "heading", "PROJECT ACTIVITIES"), 1);
  assert.ok(
    (
      await weekBlock(
        "Previously planned",
        LEAD_FORM_FIXTURE.previousText,
        PRODUCT,
      )
    ).includes(LEAD_FORM_FIXTURE.previousText),
  );
  assert.ok(
    (
      await weekBlock("Current week", LEAD_FORM_FIXTURE.currentText, PRODUCT)
    ).includes("Development"),
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

void test("health inspection preserves pending input and restores focus", async () => {
  await openLeadReport();
  await openProgress(LEAD_FORM_FIXTURE.currentText, "Current week", PRODUCT);
  const pending = `${LEAD_FORM_FIXTURE.currentText} pending`;
  await fill("Description *", pending);
  const before = await writeCount();
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

void test("Update progress saves current and next week through the canonical editor", async () => {
  await openLeadReport();
  for (const week of ["Current week", "Next week"] as const) {
    const text = `E2E canonical ${week} activity`;
    await addActivity(text, week);
    await openProgress(text, week);
    const updated = `${text} updated`;
    await fill("Description *", updated);
    await findRole("button", "In progress", "click");
    await pressSaveShortcut("Description *");
    await waitClosed({ role: "form", name: `${week} update for ${ACTIVITY}` });
    await saveDraft();
    await reloadOverview();
    const stored = await weekBlock(week, updated);
    assert.ok(stored.includes("In progress"));
    assert.equal(stored.includes("Unplanned"), week === "Current week");
    await findRole("button", `Edit item: ${updated}`, "click");
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

void test("More actions edits details and moves between current and next week", async () => {
  await openLeadReport();
  const text = "E2E reversible week placement";
  await addActivity(text);
  await moreAction(text, `Edit details: ${text}`);
  await findRole("radio", "Next week", "click");
  await fill("Description *", `${text} discarded`);
  await command(["press", "Escape"]);
  await discardChanges();
  await reloadOverview();
  assert.ok((await weekBlock("Current week", text)).includes(text));
  await moreAction(text, `Edit details: ${text}`);
  await findRole("radio", "Next week", "click");
  await namedBlock("form", `Next week update for ${ACTIVITY}`);
  await saveUpdate("Next week");
  await reloadOverview();
  await assertPlacement("Next week", text);
  await moreAction(text, `Move ${text} to this week`);
  await saveUpdate("Current week");
  await reloadOverview();
  await assertPlacement("Current week", text);
  await moreAction(text, `Move ${text} to next week`);
  await saveUpdate("Next week");
  await reloadOverview();
  await assertPlacement("Next week", text);
  assert.equal(
    refsByRole(await snapshot(), "button", `Update progress for ${text}`)
      .length,
    1,
  );
});

void test("Edit details changes the parent and persists its owned stage", async () => {
  await openLeadReport();
  const text = "E2E canonical parent placement";
  await addActivity(text);
  await moreAction(text, `Edit details: ${text}`);
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
      assert.ok((await weekBlock(week, text)).includes(status));
      await moreAction(text, `Edit details: ${text}`);
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

void test("leaving Paused clears the saved reason", async () => {
  await openLeadReport();
  const text = "E2E pause reason is cleared";
  await startActivity(text);
  await findRole("button", "Paused", "click");
  await fill("Pause reason *", "E2E reason to clear");
  await saveUpdate("Current week");
  await openProgress(text, "Current week");
  await findRole("button", "In progress", "click");
  await saveUpdate("Current week");
  await reloadOverview();
  assert.ok(
    !(await weekBlock("Current week", text)).includes("E2E reason to clear"),
  );
  await openProgress(text, "Current week");
  await findRole("button", "Paused", "click");
  assert.equal(await value("Pause reason *"), "");
  await cancelUpdate("Current week");
  await discardChanges();
});

void test("covering risk locks canonical item status", async () => {
  await openLeadReport();
  await openProgress(LEAD_FORM_FIXTURE.currentText, "Current week", PRODUCT);
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
});

void test("Resolve plan records Done immediately with retained audit", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const text = "E2E terminal completed result";
  await addActivity(text);
  await moreAction(text, `Update status: ${text}`);
  await findRole("button", "Done", "click");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  assert.ok((await weekBlock("Current week", text)).includes("Done"));
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
  await moreAction(text, `Update status: ${text}`);
  await findRole("button", "Done", "click");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  await assertPlacement("Current week", text);
  assert.ok((await weekBlock("Current week", text)).includes("Done"));
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
    await moreAction(text, `Update status: ${text}`);
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
    await moreAction(text, `Update status: ${text}`);
    await findRole("button", "Won't do", "click");
    await findRole("button", "Save outcome", "click");
    await waitText("Explain why this plan will not be done.");
    await fill("Why won't this be done?", "E2E superseded requirement");
    await findRole("button", "Save outcome", "click");
    await waitClosed({ role: "form", name: "Resolve plan" });
    await reloadOverview();
    assert.ok(
      (await weekBlock(week, text)).includes(
        "Won't do · E2E superseded requirement",
      ),
    );
    await findRole("button", `Restore ${text}`, "click");
    await waitText("Plan restored");
    await waitClosed({ role: "form", name: "Restore plan" });
    await reloadOverview();
    assert.equal(
      refsByRole(await snapshot(), "button", `Restore ${text}`).length,
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
  await waitOpenWork();
  const row = await openWorkRow(OPEN_WORK_FIXTURE.continue);
  const controls = refsByRole(row, "button", "Continue work");
  assert.equal(
    controls.length,
    1,
    `Continue work; names seen: ${roleNames(row, "button")}`,
  );
  const control = controls[0];
  assert.ok(control);
  await command(["click", control]);
  await fill("This period's update", "E2E finished recovered historical work");
  await findRole("button", "Done", "click");
  await waitClosed({ role: "form", name: "Resolve plan" });
  await reloadOverview();
  assert.ok(
    (
      await weekBlock("Current week", "E2E finished recovered historical work")
    ).includes("Done"),
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
    await waitText(text);
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
    await waitOpenWork();
    const observed = await snapshot();
    const history = scopeCount(
      observed,
      "DisclosureTriangle",
      /^Completed and cancelled work \(\d+\)$/,
    );
    assert.equal(
      history,
      1,
      `Terminal work; names seen: ${roleNames(observed, "DisclosureTriangle")}`,
    );
    await command([
      "find",
      "role",
      "DisclosureTriangle",
      "click",
      "--name",
      "Completed and cancelled work",
    ]);
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
    LEAD_FORM_FIXTURE.previousText,
    PRODUCT,
  );
  assert.ok(previous.includes(LEAD_FORM_FIXTURE.previousText));
  assert.doesNotMatch(
    previous,
    /(?:button|DisclosureTriangle) "(?:Update progress|Edit item:|More actions|Move |Update status:|Restore |Confirm)/u,
  );
  await reloadOverview();
  assert.ok(
    (
      await weekBlock(
        "Previously planned",
        LEAD_FORM_FIXTURE.previousText,
        PRODUCT,
      )
    ).includes(LEAD_FORM_FIXTURE.previousText),
  );
  assert.equal(await writeCount(), before);
});

void test("Previous historical replan creates active work without changing its plan", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const text = LEAD_FORM_FIXTURE.previousText;
  await weekBlock("Previously planned", text, PRODUCT);
  await findRole("button", `Plan this work: ${shortItemLabel(text)}`, "click");
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

void test("carried work confirms through Update progress without duplicate continuation", async () => {
  await openLeadReport();
  const parent = LEAD_FORM_FIXTURE.carriedProductName;
  const text = LEAD_FORM_FIXTURE.carriedText;
  assert.ok(
    (
      await weekBlock("Next week", LEAD_FORM_FIXTURE.explicitNextText, parent)
    ).includes("Planned"),
  );
  assert.ok(
    (await weekBlock("Current week", text, parent)).includes(
      "not updated this week",
    ),
  );
  await openProgress(text, "Current week", parent);
  await saveUpdate("Current week", parent);
  await reloadOverview();
  assert.ok(
    !(await weekBlock("Current week", text, parent)).includes(
      "not updated this week",
    ),
  );
  assert.equal(
    refsByRole(
      await snapshot(),
      "button",
      `Update progress for ${shortItemLabel(text)}`,
    ).length,
    1,
  );
  const next = await weekBlock(
    "Next week",
    LEAD_FORM_FIXTURE.explicitNextText,
    parent,
  );
  assert.ok(next.includes("Planned"));
  assert.equal(
    refsByRole(
      await snapshot(),
      "button",
      `Update progress for ${LEAD_FORM_FIXTURE.explicitNextText}`,
    ).length,
    1,
  );
});

for (const week of ["Current week", "Next week"] as const) {
  void test(`moving the explicit commitment to ${week} retains its previous result`, async () => {
    await openLeadReport();
    const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
    await openLeadReport();
    const parent = LEAD_FORM_FIXTURE.carriedProductName;
    await openProgress(LEAD_FORM_FIXTURE.carriedText, "Current week", parent);
    await saveUpdate("Current week", parent);
    const sourceText =
      week === "Current week"
        ? LEAD_FORM_FIXTURE.explicitNextText
        : LEAD_FORM_FIXTURE.carriedText;
    await weekBlock(
      week === "Current week" ? "Next week" : "Current week",
      sourceText,
      parent,
    );
    await moreAction(
      sourceText,
      `Move ${shortItemLabel(sourceText)} to ${week === "Current week" ? "this week" : "next week"}`,
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
      refsByRole(
        await snapshot(),
        "button",
        `Update progress for ${LEAD_FORM_FIXTURE.explicitNextText}`,
      ).length,
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
  const row = await openWorkRow(OPEN_WORK_FIXTURE.continue);
  const controls = refsByRole(row, "button", "Continue work");
  assert.equal(
    controls.length,
    1,
    `Continue work; names seen: ${roleNames(row, "button")}`,
  );
  const control = controls[0];
  assert.ok(control);
  await command(["click", control]);
  await waitText("Resolve plan");
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
  assert.ok(active.includes("In progress"));
  const next = await weekBlock("Next week", nextStep, PRODUCT);
  assert.ok(next.includes("Planned"));
  assert.equal(
    refsByRole(
      await snapshot(),
      "button",
      `Update progress for ${shortItemLabel(nextStep)}`,
    ).length,
    1,
  );
  await openProgress(result, "Current week", PRODUCT);
  assert.equal(await stageChecked("Development"), true);
  assert.equal(await value("Description *"), result);
  await cancelUpdate("Current week", PRODUCT);
  await waitClosed({
    role: "form",
    name: `Current week update for ${PRODUCT}`,
  });
  await waitOpenWork();
  assert.ok(
    !(await namedBlock("region", "Open work from earlier periods")).includes(
      OPEN_WORK_FIXTURE.continue,
    ),
  );
  assert.equal(await historyText(OPEN_WORK_FIXTURE.archiveReportId), previous);
});

void test("outcome and restore failures retain inputs and retry with audit", async () => {
  await openLeadReport();
  const previous = await historyText(LEAD_FORM_FIXTURE.previousReportId);
  await openLeadReport();
  const text = "E2E outcome transport retries preserve lineage";
  const reason = "E2E cancellation input retained after a transport failure";
  await addActivity(text);
  await moreAction(text, `Update status: ${text}`);
  await findRole("button", "Won't do", "click");
  await fill("Why won't this be done?", reason);
  const resolveRoute = "**/trpc/*leadForm.resolvePlan*";
  await command(["network", "route", resolveRoute, "--abort"]);
  try {
    await findRole("button", "Save outcome", "click");
    assert.ok((await waitPlanFailure("Resolve plan")).includes(text));
    assert.equal(await value("Why won't this be done?"), reason);
    const unresolved = await weekBlock("Current week", text);
    assert.ok(unresolved.includes("In progress"));
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
    await findRole("button", `Restore ${text}`, "click");
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
  assert.equal(
    refsByRole(await snapshot(), "button", `Update progress for ${text}`)
      .length,
    1,
  );
  await findRole("DisclosureTriangle", "History · 2", "click");
  const restored = await weekBlock("Current week", text);
  assert.ok(
    restored.includes(`Marked Won't do by ${LEAD_FORM_FIXTURE.leadName}`),
  );
  assert.ok(restored.includes(reason));
  assert.ok(
    restored.includes(`Restored plan by ${LEAD_FORM_FIXTURE.leadName}`),
  );
  assert.ok(restored.includes("In progress"));
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
  assert.ok(next.includes("Planned"));
  assert.equal(
    refsByRole(
      await snapshot(),
      "button",
      `Update progress for ${shortItemLabel(nextStep)}`,
    ).length,
    1,
  );
  await openProgress(result, "Current week");
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
  assert.ok((await weekBlock("Next week", commitment)).includes("Planned"));
  await openProgress(commitment, "Next week");
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
  await moreAction(text, `Update status: ${text}`);
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
  await waitOpenWork();
  const savedData = await roleText("region", "Status overview");
  const savedWork = await roleText("region", "Open work from earlier periods");
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
  await waitOpenWork();
  const reloaded = await roleText("region", "Status overview");
  assert.equal(reloaded, savedData);
  assert.ok(!reloaded.includes(result));
  assert.ok(!reloaded.includes(nextStep));
  assert.equal(
    await roleText("region", "Open work from earlier periods"),
    savedWork,
  );
  assert.ok(
    (await openWorkRow(OPEN_WORK_FIXTURE.continue)).snapshot.includes(
      "Continue work",
    ),
  );
  assert.equal(await writeCount("leadForm.resolvePlan"), before + 2);
  assert.equal(await historyText(OPEN_WORK_FIXTURE.archiveReportId), previous);
});
