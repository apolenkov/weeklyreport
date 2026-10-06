import assert from "node:assert/strict";
import test from "node:test";

import { prepareE2eData } from "../setup/reset.js";
import { loginAsHead, openLeadReport } from "./access.js";
import {
  type BrowserSnapshot,
  command,
  fill as fillField,
  findRole,
  getAttr,
  headSession,
  isVisible,
  open,
  refsByRole,
  reload,
  snapshot,
  waitText,
} from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import { assertFocused } from "./focus.js";
import {
  clickBackdrop,
  LEAD_FORM_FIXTURE,
  modalScopeScript,
  roleText,
  saveDraft,
  type Scope,
  scopeCount,
  scopedRef,
  scopeSnapshot,
  setOffline,
  waitClosed,
  waitNotification,
  waitScope,
} from "./helpers.js";

registerE2eHooks();

type Week = "Current" | "Next";
interface ParentCase {
  readonly kind: "product" | "activity";
  readonly name: string;
}
interface SlideRecord {
  readonly kind: "Item" | "Risk" | "Decision";
  readonly parent: ParentCase;
  readonly text: string;
}

const PRODUCT: ParentCase = {
  kind: "product",
  name: LEAD_FORM_FIXTURE.productName,
};
const ACTIVITY: ParentCase = {
  kind: "activity",
  name: LEAD_FORM_FIXTURE.activityName,
};
const PARENTS: readonly ParentCase[] = [PRODUCT, ACTIVITY];
const PRIORITY_LABEL =
  "Priority rank (optional — leave blank if not a priority)";
const WEEKLY_FORM: Scope = {
  role: "form",
  name: `Weekly fields for ${LEAD_FORM_FIXTURE.activityName}`,
};
const DECISION_DIALOG: Scope = {
  role: "dialog",
  name: /^(Add|Edit) decision$/,
};
const ITEM_DIALOG: Scope = { role: "dialog", name: /^Edit item — / };
const RISK_DIALOG: Scope = { role: "dialog", name: /^(Add|Edit) risk — / };
const DEADLINE_SEGMENTS = [
  { maximum: "12", digits: "01" },
  { maximum: "31", digits: "01" },
  { maximum: "275760", digits: "2000" },
] as const;
const SAVE_ROUTE = "**/trpc/*reports.saveDraft*";
const FETCH_FAILURE = "Failed to fetch";
const MINIMAL_CURRENT_TEXT = "Minimal editable report item";
const PUBLISHED_RECORD_LOCKED =
  "This record is part of the published report. Mark it done or carry it forward — it cannot be deleted.";
const NO_MODALS =
  "!Array.from(document.getElementsByTagName('div')).some(element => ['dialog', 'alertdialog'].includes(element.getAttribute('role')) && element.getAttribute('aria-modal') === 'true')";
const NO_INLINE_EDITORS =
  "!Array.from(document.getElementsByTagName('form')).some(form => form.getAttribute('aria-label')?.includes('week update for'))";

async function ref(role: string, name: string): Promise<string> {
  const matches = refsByRole(await snapshot(), role, name);
  assert.equal(matches.length, 1, `Expected one ${role}: ${name}`);
  const match = matches.at(0);
  assert.ok(match);
  return match;
}

async function click(name: string, session?: string): Promise<void> {
  await findRole("button", name, "click", { session });
}

async function scopedClick(
  scope: Scope,
  name: string,
  session?: string,
): Promise<void> {
  await command(
    ["click", await scopedRef(scope, "button", name, session)],
    session,
  );
}

async function select(name: string, value: string): Promise<void> {
  await command(["select", await ref("combobox", name), value]);
}

async function value(role: string, name: string): Promise<unknown> {
  return (await command(["get", "value", await ref(role, name)])).value;
}

async function fill(label: string, text: string): Promise<void> {
  if (text !== "") {
    await fillField(label, text);
    return;
  }
  await clearTextbox(await ref("textbox", label));
}

async function clearTextbox(target: string): Promise<void> {
  const original = (await command(["get", "value", target])).value;
  assert.ok(typeof original === "string");
  assert.doesNotMatch(
    original,
    /[\r\n]/,
    "Keyboard clear expects a single line",
  );
  await command(["click", target]);
  await command(["press", "End"]);
  await command(["press", "Shift+Home"]);
  const selection = (
    await command([
      "eval",
      "({start: document.activeElement?.selectionStart, end: document.activeElement?.selectionEnd, value: document.activeElement?.value})",
    ])
  ).result;
  assert.deepEqual(selection, {
    start: 0,
    end: original.length,
    value: original,
  });
  await command(["press", "Backspace"]);
  assert.equal((await command(["get", "value", target])).value, "");
}

async function checked(name: string): Promise<boolean> {
  return (await command(["is", "checked", await ref("checkbox", name)]))
    .checked as boolean;
}

async function waitModal(
  name?: string,
  role: "dialog" | "alertdialog" = "dialog",
  session?: string,
): Promise<void> {
  const scope: Scope = { role, name: name ?? /.*/u };
  await command(["wait", "--fn", modalScopeScript(scope)], session);
  await waitScope(scope, session);
}

async function assertModal(name: string): Promise<void> {
  await waitModal(name);
  await waitText(name);
  assert.equal(scopeCount(await snapshot(), "dialog", name), 1);
  assert.ok((await roleText("dialog", name)).includes(name));
}

async function waitNoModals(session?: string): Promise<void> {
  await command(["wait", "--fn", NO_MODALS], session).catch(
    async (error: unknown) => {
      if (error instanceof Error && error.name !== "AbortError") {
        error.message += `\n${(await snapshot(session)).snapshot}`;
      }
      throw error;
    },
  );
  const data = await snapshot(session);
  assert.equal(scopeCount(data, "dialog"), 0);
  assert.equal(scopeCount(data, "alertdialog"), 0);
}

async function openSlides(): Promise<void> {
  await openLeadReport("slides");
  await click("Document");
  assert.equal(
    await getAttr(await ref("button", "Document"), "aria-pressed"),
    "true",
  );
}

async function expandOverviewParent(parent: ParentCase): Promise<void> {
  const scope: Scope = {
    role: "article",
    name: `${parent.kind === "product" ? "Product" : "Activity"} ${parent.name}`,
  };
  const data = scopeSnapshot(await waitScope(scope), scope.role, scope.name);
  const more = refsByRole(data, "button", /^\+\d+ more$/);
  assert.ok(more.length <= 1);
  const target = more.at(0);
  if (target) {
    await command(["click", target]);
    assert.equal(
      await getAttr(
        await scopedRef(scope, "button", "Show less"),
        "aria-expanded",
      ),
      "true",
    );
  }
}

async function persistedReload(
  text: string,
  parent?: ParentCase,
): Promise<void> {
  await reload();
  await waitText("My Report");
  if (parent) await expandOverviewParent(parent);
  await waitText(text);
  assert.ok((await snapshot()).snapshot.includes(text));
}

async function selectProductStages(): Promise<void> {
  await command(["check", await ref("checkbox", "Development")]);
  await command(["check", await ref("checkbox", "Testing")]);
  assert.equal(await checked("Development"), true);
  assert.equal(await checked("Testing"), true);
}

async function createItem(
  parent: ParentCase,
  week: Week,
  text: string,
): Promise<void> {
  await waitText(parent.name);
  await click(`Add item to ${parent.name}`);
  await waitScope({
    role: "form",
    name: `Current week update for ${parent.name}`,
  });
  if (week === "Next") {
    await findRole("radio", "Next week", "click");
    await waitScope({
      role: "form",
      name: `Next week update for ${parent.name}`,
    });
    // Switching weeks preserves the open draft's progress choice.
    await click("Planned");
    assert.equal(
      await getAttr(await ref("button", "Planned"), "aria-pressed"),
      "true",
    );
  }
  await fill("Description *", text);
  if (parent.kind === "product") await selectProductStages();
  else assert.equal(scopeCount(await snapshot(), "group", "SDLC Stages"), 0);
  await click("Save update");
  await waitClosed({
    role: "form",
    name: `${week} week update for ${parent.name}`,
  });
  await expandOverviewParent(parent);
  await waitText(text);
  await saveDraft();
}

async function openSlideRecord(record: SlideRecord): Promise<void> {
  const data = await snapshot();
  const candidates = Object.entries(data.refs).filter(
    ([, entry]) =>
      entry.role === "button" &&
      /^(Expand|Collapse) full details for /.test(entry.name ?? "") &&
      entry.name?.endsWith(`: ${record.text}`),
  );
  assert.equal(candidates.length, 1, `Expected one row for ${record.text}`);
  const candidate = candidates.at(0);
  assert.ok(candidate);
  const [id, entry] = candidate;
  const rowName = entry.name;
  assert.ok(rowName);
  const hoverLabel = rowName
    .replace(/^(Expand|Collapse) full details for /, "")
    .slice(0, -`: ${record.text}`.length);
  if (rowName.startsWith("Expand")) await command(["click", `@${id}`]);
  const editName = `Edit ${hoverLabel}: ${record.text}`;
  const edit = await ref("button", editName);
  await command(["focus", edit]);
  assert.equal(await activeName(), editName);
  await command(["press", "Enter"]);
  await assertModal(
    record.kind === "Decision"
      ? "Edit decision"
      : `Edit ${record.kind.toLowerCase()} — ${record.parent.name}`,
  );
}

async function saveSlide(label: string): Promise<void> {
  const target = await scopedRef(
    { role: "dialog", name: /^Edit / },
    "button",
    label,
  );
  assert.equal((await command(["is", "enabled", target])).enabled, true);
  await command(["focus", target]);
  assert.equal(await activeName(), label);
  await command([
    "press",
    process.platform === "darwin" ? "Meta+Enter" : "Control+Enter",
  ]);
  await waitNoModals();
  await waitText("Slide record saved");
}

async function deleteSlideRecord(
  record: SlideRecord,
  title: string,
): Promise<void> {
  await click("Delete");
  await waitModal(title, "alertdialog");
  assert.equal(scopeCount(await snapshot(), "alertdialog", title), 1);
  assert.equal(scopeCount(await snapshot(), "dialog"), 0);
  await scopedClick({ role: "alertdialog", name: title }, "Cancel");
  await waitNoModals();
  await waitText(record.text);
  await openSlideRecord(record);
  await click("Delete");
  await waitModal(title, "alertdialog");
  await scopedClick({ role: "alertdialog", name: title }, "Delete");
  await waitNoModals();
  await waitText("Slide record deleted");
  await reload();
  await waitText("My Report");
  await waitText(LEAD_FORM_FIXTURE.currentText);
  assert.equal((await snapshot()).snapshot.includes(record.text), false);
}

for (const parent of PARENTS) {
  for (const week of ["Current", "Next"] as const) {
    void test(`${parent.kind} ${week} items support create, edit and delete`, async () => {
      const text = `E2E ${parent.kind} ${week.toLowerCase()} item`;
      await openLeadReport();
      await createItem(parent, week, text);
      await persistedReload(text, parent);
      await openSlides();
      await openSlideRecord({ kind: "Item", parent, text });
      const edited = `${text} edited`;
      await fill("Description *", edited);
      await saveSlide("Save item");
      await persistedReload(edited);
      const record: SlideRecord = { kind: "Item", parent, text: edited };
      await openSlideRecord(record);
      assert.equal(await value("textbox", "Description *"), edited);
      await deleteSlideRecord(
        record,
        week === "Current" ? "Delete item?" : "Delete next-week item?",
      );
    });
  }
}

async function assertItemExtras(nextStep: string, rank: string): Promise<void> {
  assert.equal(await value("textbox", "Next step (optional)"), nextStep);
  assert.equal(await value("combobox", PRIORITY_LABEL), rank);
}

async function assertNoForeignStages(): Promise<void> {
  const data = scopeSnapshot(
    await snapshot(),
    ITEM_DIALOG.role,
    ITEM_DIALOG.name,
  );
  for (const name of ["Planning", "Analysis", "Design"])
    assert.equal(refsByRole(data, "checkbox", name).length, 0);
}

async function assertNoItemStages(): Promise<void> {
  const data = scopeSnapshot(
    await snapshot(),
    ITEM_DIALOG.role,
    ITEM_DIALOG.name,
  );
  assert.equal(scopeCount(data, "group", "SDLC Stages"), 0);
}

async function assertSingleStageProduct(): Promise<void> {
  const data = scopeSnapshot(
    await snapshot(),
    ITEM_DIALOG.role,
    ITEM_DIALOG.name,
  );
  const stage = scopeSnapshot(data, "group", "SDLC Stages");
  assert.ok(stage.snapshot.includes(LEAD_FORM_FIXTURE.singleStageName));
  assert.equal(refsByRole(data, "checkbox", /.*/).length, 0);
}

async function stageInvalid(): Promise<unknown> {
  return (
    await command([
      "eval",
      "Array.from(document.getElementsByTagName('fieldset')).find(fieldset => fieldset.firstElementChild?.tagName === 'LEGEND' && fieldset.firstElementChild.textContent?.trim() === 'SDLC Stages')?.getAttribute('aria-invalid')",
    ])
  ).result;
}

async function switchToMultiStageProduct(text: string): Promise<void> {
  await select("Parent", PRODUCT.name);
  await assertModal(`Edit item — ${PRODUCT.name}`);
  await assertItemExtras("E2E retained next step", "10");
  assert.equal(await value("textbox", "Description *"), text);
  assert.equal(await checked("Development"), false);
  assert.equal(await checked("Testing"), false);
  await assertNoForeignStages();
  await click("Save item");
  await waitText("Select at least one stage.");
  assert.equal(await stageInvalid(), "true");
  await selectProductStages();
  await saveSlide("Save item");
  await persistedReload(text);
  await openSlideRecord({ kind: "Item", parent: PRODUCT, text });
  assert.equal(await checked("Development"), true);
  assert.equal(await checked("Testing"), true);
}

void test("canonical item parent and stage choices preserve valid ownership", async () => {
  const text = "E2E parent choice item";
  await openLeadReport();
  await createItem(ACTIVITY, "Current", text);
  await openSlides();
  await openSlideRecord({ kind: "Item", parent: ACTIVITY, text });
  await fill("Next step (optional)", "E2E retained next step");
  await select(PRIORITY_LABEL, "10");
  await switchToMultiStageProduct(text);
  await select("Parent", LEAD_FORM_FIXTURE.singleStageProductName);
  await waitText("Applied automatically");
  await assertSingleStageProduct();
  await assertItemExtras("E2E retained next step", "10");
  await saveSlide("Save item");
  await persistedReload(text);
  await openSlideRecord({
    kind: "Item",
    parent: { kind: "product", name: LEAD_FORM_FIXTURE.singleStageProductName },
    text,
  });
  await select("Parent", ACTIVITY.name);
  await assertModal(`Edit item — ${ACTIVITY.name}`);
  await assertNoItemStages();
  await assertItemExtras("E2E retained next step", "10");
  await saveSlide("Save item");
  await persistedReload(text);
  await openSlideRecord({ kind: "Item", parent: ACTIVITY, text });
  await assertNoItemStages();
  await assertItemExtras("E2E retained next step", "10");
  await click("Cancel");
  await waitNoModals();
});

async function assertPriorityOptions(): Promise<void> {
  const data = scopeSnapshot(await snapshot(), "combobox", PRIORITY_LABEL);
  assert.equal(scopeCount(data, "option", "1 (taken)"), 1);
  assert.equal(scopeCount(data, "option", "10"), 1);
  const lines = data.snapshot.split("\n");
  const disabled = /\bdisabled\b/;
  assert.ok(
    lines.some(
      (line) => line.includes('option "1 (taken)"') && disabled.test(line),
    ),
  );
  assert.ok(
    lines.some((line) => line.includes('option "10"') && !disabled.test(line)),
  );
}

void test("canonical item next step and priority persist and clear", async () => {
  const record: SlideRecord = {
    kind: "Item",
    parent: ACTIVITY,
    text: "E2E priority item",
  };
  await openLeadReport();
  await createItem(ACTIVITY, "Current", record.text);
  await openSlides();
  await openSlideRecord(record);
  await assertPriorityOptions();
  await fill("Next step (optional)", "E2E next commitment");
  await select(PRIORITY_LABEL, "10");
  await saveSlide("Save item");
  await persistedReload(record.text);
  await openSlideRecord(record);
  await assertItemExtras("E2E next commitment", "10");
  assert.equal(scopeCount(await snapshot(), "option", "10 (taken)"), 0);
  await click("Done");
  await click("Save item");
  await waitText(
    "A completed item cannot have a next step. Resume it or clear the plan.",
  );
  assert.equal(
    await getAttr(await ref("textbox", "Next step (optional)"), "aria-invalid"),
    "true",
  );
  await fill("Next step (optional)", "");
  await select(PRIORITY_LABEL, "");
  await saveSlide("Save item");
  await persistedReload(record.text);
  await openSlideRecord(record);
  await assertItemExtras("", "");
  assert.equal(
    await getAttr(await ref("button", "Done"), "aria-pressed"),
    "true",
  );
  await click("Cancel");
  await waitNoModals();
});

async function firstInvalidLabel(): Promise<unknown> {
  return (
    await command([
      "eval",
      "Array.from(document.activeElement?.labels ?? []).map(label => label.textContent?.trim()).join(' ')",
    ])
  ).result;
}

async function activeName(): Promise<unknown> {
  return (
    await command([
      "eval",
      "document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim()",
    ])
  ).result;
}

async function discardDirtyDialog(
  field: string,
  unsaved: string,
  modalName: string,
): Promise<void> {
  await fill(field, unsaved);
  await click("Cancel");
  await waitModal("Discard changes?", "alertdialog");
  assert.equal(
    scopeCount(await snapshot(), "alertdialog", "Discard changes?"),
    1,
  );
  await scopedClick(
    { role: "alertdialog", name: "Discard changes?" },
    "Keep editing",
  );
  assert.equal(await value("textbox", field), unsaved);
  await clickBackdrop(modalName);
  await waitModal("Discard changes?", "alertdialog");
  assert.equal(
    scopeCount(await snapshot(), "alertdialog", "Discard changes?"),
    1,
  );
  await scopedClick(
    { role: "alertdialog", name: "Discard changes?" },
    "Keep editing",
  );
  assert.equal(await value("textbox", field), unsaved);
  await command(["press", "Escape"]);
  await waitModal("Discard changes?", "alertdialog");
  await scopedClick(
    { role: "alertdialog", name: "Discard changes?" },
    "Discard",
  );
  await waitNoModals();
}

async function validateSupportingDialog(
  kind: "Risk" | "Decision",
): Promise<void> {
  await openSupportingDialog(kind);
  await select("Parent", ACTIVITY.name);
  await click(`Save ${kind.toLowerCase()}`);
  const field = `${kind} *`;
  assert.equal(
    await getAttr(await ref("textbox", field), "aria-invalid"),
    "true",
  );
  assert.equal(await firstInvalidLabel(), field);
  assert.equal(
    await getAttr(await ref("textbox", "Impact *"), "aria-invalid"),
    "true",
  );
  if (kind === "Risk")
    assert.equal(
      await getAttr(await ref("textbox", "Mitigation *"), "aria-invalid"),
      "true",
    );
  await discardDirtyDialog(
    field,
    `E2E unsaved ${kind.toLowerCase()}`,
    kind === "Risk" ? `Add risk — ${ACTIVITY.name}` : "Add decision",
  );
  await assertFocused(`+ Add ${kind.toLowerCase()}`);
  await openSupportingDialog(kind);
  await click("Cancel");
  await waitNoModals();
  await assertFocused(`+ Add ${kind.toLowerCase()}`);
}

async function openSupportingDialog(kind: "Risk" | "Decision"): Promise<void> {
  const name = `+ Add ${kind.toLowerCase()}`;
  await command(["focus", await ref("button", name)]);
  assert.equal(await activeName(), name);
  await click(name);
  await waitModal();
}

void test("canonical record dialogs validate required fields and discard unsaved changes", async () => {
  const record: SlideRecord = {
    kind: "Item",
    parent: ACTIVITY,
    text: "E2E discard item",
  };
  await openLeadReport();
  await createItem(ACTIVITY, "Current", record.text);
  await openSlides();
  await openSlideRecord(record);
  await fill("Description *", "");
  await click("Save item");
  await waitText("Description is required");
  assert.equal(
    await getAttr(await ref("textbox", "Description *"), "aria-invalid"),
    "true",
  );
  assert.equal(await firstInvalidLabel(), "Description *");
  await discardDirtyDialog(
    "Description *",
    "E2E unsaved item",
    `Edit item — ${ACTIVITY.name}`,
  );
  await assertFocused(`Edit In progress: ${record.text}`);
  await openSlideRecord(record);
  assert.equal(await value("textbox", "Description *"), record.text);
  await click("Cancel");
  await waitNoModals();
  await persistedReload(record.text);
  assert.equal((await snapshot()).snapshot.includes("E2E unsaved item"), false);
});

for (const kind of ["Risk", "Decision"] as const) {
  void test(`${kind.toLowerCase()} dialog validates required fields and discards unsaved changes`, async () => {
    const support = kind === "Risk" ? "Risks & Blockers" : "Decisions";
    await openLeadReport();
    await expandSupport(support);
    const baseline = await roleText("region", support);
    await validateSupportingDialog(kind);
    await persistedReload(LEAD_FORM_FIXTURE.currentText);
    await expandSupport(support);
    assert.equal(await roleText("region", support), baseline);
    assert.equal(
      (await snapshot()).snapshot.includes(`E2E unsaved ${kind.toLowerCase()}`),
      false,
    );
  });
}

async function selectRiskSeverity(name: "At risk" | "Blocked"): Promise<void> {
  await command([
    "scrollintoview",
    await scopedRef(RISK_DIALOG, "button", name),
  ]);
  await scopedClick(RISK_DIALOG, name);
  assert.equal(
    await getAttr(await scopedRef(RISK_DIALOG, "button", name), "aria-pressed"),
    "true",
  );
}

async function createRisk(parent: ParentCase, text: string): Promise<void> {
  await click("+ Add risk");
  await waitModal();
  await select("Parent", parent.name);
  await fill("Risk *", text);
  await fill("Impact *", `${text} impact`);
  await fill("Mitigation *", `${text} mitigation`);
  await selectRiskSeverity("At risk");
  if (parent.kind === "product") await selectProductStages();
  else assert.equal(scopeCount(await snapshot(), "group", "SDLC Stages"), 0);
  await click("Save risk");
  await waitNoModals();
  await saveDraft();
}

for (const parent of PARENTS) {
  void test(`${parent.kind} risks support create, edit and delete`, async () => {
    const text = `E2E ${parent.kind} risk`;
    await openLeadReport();
    await createRisk(parent, text);
    await openSlides();
    const record: SlideRecord = { kind: "Risk", parent, text };
    await openSlideRecord(record);
    assert.equal(await value("textbox", "Risk *"), text);
    assert.equal(await value("textbox", "Impact *"), `${text} impact`);
    assert.equal(await value("textbox", "Mitigation *"), `${text} mitigation`);
    if (parent.kind === "product") {
      assert.equal(await checked("Development"), true);
      assert.equal(await checked("Testing"), true);
    }
    await fill("Impact *", `${text} changed impact`);
    await fill("Mitigation *", `${text} changed mitigation`);
    await selectRiskSeverity("Blocked");
    await saveSlide("Save risk");
    await persistedReload(text);
    await openSlideRecord(record);
    assert.equal(await value("textbox", "Impact *"), `${text} changed impact`);
    assert.equal(
      await value("textbox", "Mitigation *"),
      `${text} changed mitigation`,
    );
    assert.equal(
      await getAttr(await ref("button", "Blocked"), "aria-pressed"),
      "true",
    );
    await deleteSlideRecord(record, "Delete risk?");
  });
}

async function expandSupport(
  name: "Risks & Blockers" | "Decisions",
): Promise<void> {
  const data = await snapshot();
  if (refsByRole(data, "button", `Expand ${name}`).length === 1)
    await click(`Expand ${name}`);
  assert.equal(scopeCount(await snapshot(), "region", name), 1);
}

void test("risk severity escalates and downgrades without opening editor", async () => {
  await openLeadReport();
  await waitText(PRODUCT.name);
  const productBefore = await roleText("article", `Product ${PRODUCT.name}`);
  await createRisk(ACTIVITY, "E2E direct severity risk");
  await expandSupport("Risks & Blockers");
  await click(`Escalate risk for ${ACTIVITY.name} to blocked`);
  await saveDraft();
  assert.equal(scopeCount(await snapshot(), "dialog"), 0);
  assert.equal(
    await isVisible(
      await ref("button", `Downgrade risk for ${ACTIVITY.name} to at risk`),
    ),
    true,
  );
  await persistedReload(ACTIVITY.name);
  await expandSupport("Risks & Blockers");
  assert.equal(
    await isVisible(
      await ref("button", `Downgrade risk for ${ACTIVITY.name} to at risk`),
    ),
    true,
  );
  await click(`Downgrade risk for ${ACTIVITY.name} to at risk`);
  await saveDraft();
  await persistedReload(ACTIVITY.name);
  await expandSupport("Risks & Blockers");
  assert.equal(
    await isVisible(
      await ref("button", `Escalate risk for ${ACTIVITY.name} to blocked`),
    ),
    true,
  );
  const product = await roleText("article", `Product ${PRODUCT.name}`);
  assert.equal(product, productBefore);
});

async function deadlineValue(): Promise<unknown> {
  return (
    await command([
      "eval",
      "Array.from(document.getElementsByTagName('label')).find(label => label.textContent?.trim() === 'Deadline')?.control?.value",
    ])
  ).result;
}

async function deadlineSegmentNames(): Promise<ReadonlyMap<string, string>> {
  const data = scopeSnapshot(
    await snapshot(),
    DECISION_DIALOG.role,
    DECISION_DIALOG.name,
  );
  const segments = Object.values(data.refs).filter(
    (entry) => entry.role === "spinbutton",
  );
  assert.equal(segments.length, 3, "Expected three native date segments");
  const names = new Set<string>();
  const ranges = new Map<string, string>();
  for (const segment of segments) {
    const name = segment.name;
    assert.ok(
      typeof name === "string" && name.trim(),
      "Date segment needs an accessible name",
    );
    assert.ok(!names.has(name), "Date segment names must be unique");
    names.add(name);
    const target = await scopedRef(DECISION_DIALOG, "spinbutton", name);
    assert.equal(await getAttr(target, "aria-valuemin"), "1");
    const maximum = await getAttr(target, "aria-valuemax");
    assert.ok(maximum);
    assert.ok(DEADLINE_SEGMENTS.some((field) => field.maximum === maximum));
    assert.ok(!ranges.has(maximum), "Date segment ranges must be unique");
    ranges.set(maximum, name);
  }
  return ranges;
}

async function setDeadline(deadline: "2000-01-01" | ""): Promise<void> {
  // Native date segment names follow the browser locale; their ranges are stable.
  const names = await deadlineSegmentNames();
  for (const segment of DEADLINE_SEGMENTS) {
    const name = names.get(segment.maximum);
    assert.ok(name);
    await command([
      "click",
      await scopedRef(DECISION_DIALOG, "spinbutton", name),
    ]);
    await command(["press", "Backspace"]);
    for (const digit of deadline === "" ? "" : segment.digits)
      await command(["press", digit]);
  }
  await command([
    "click",
    await scopedRef(DECISION_DIALOG, "textbox", "Impact *"),
  ]);
  assert.equal(await deadlineValue(), deadline);
}

async function createDecision(parent: ParentCase, text: string): Promise<void> {
  await click("+ Add decision");
  await waitModal("Add decision");
  await select("Parent", parent.name);
  await fill("Decision *", text);
  await fill("Impact *", `${text} impact`);
  await setDeadline("2000-01-01");
  await waitText("Deadline is in the past.");
  if (parent.kind === "product") await selectProductStages();
  else assert.equal(scopeCount(await snapshot(), "group", "SDLC Stages"), 0);
  await click("Save decision");
  await waitNoModals();
  await saveDraft();
}

for (const parent of PARENTS) {
  void test(`${parent.kind} decisions support create, edit and delete`, async () => {
    const text = `E2E ${parent.kind} decision`;
    await openLeadReport();
    await createDecision(parent, text);
    await openSlides();
    const record: SlideRecord = { kind: "Decision", parent, text };
    await openSlideRecord(record);
    assert.equal(await value("textbox", "Decision *"), text);
    assert.equal(await value("textbox", "Impact *"), `${text} impact`);
    assert.equal(await deadlineValue(), "2000-01-01");
    if (parent.kind === "product") {
      assert.equal(await checked("Development"), true);
      assert.equal(await checked("Testing"), true);
    }
    await fill("Impact *", `${text} changed impact`);
    await setDeadline("");
    await saveSlide("Save decision");
    await persistedReload(text);
    await openSlideRecord(record);
    assert.equal(await value("textbox", "Impact *"), `${text} changed impact`);
    assert.equal(await deadlineValue(), "");
    await deleteSlideRecord(record, "Delete decision?");
  });
}

async function createPublishedLineageDraft(
  decisionText: string,
): Promise<void> {
  const nextText = "E2E published next commitment";
  await click(`Add item to ${PRODUCT.name}`);
  await waitText("Description *");
  assert.ok((await roleText("group", "SDLC Stages")).includes("Planning"));
  await waitText("Applied automatically");
  await findRole("radio", "Next week", "click");
  await click("Planned");
  await fill("Description *", nextText);
  await click("Save update");
  await command(["wait", "--fn", NO_INLINE_EDITORS]);
  await saveDraft();
  await click("+ Add decision");
  await assertModal("Add decision");
  assert.equal(scopeCount(await snapshot(), "combobox", "Product"), 1);
  assert.ok((await roleText("group", "SDLC Stages")).includes("Planning"));
  await fill("Decision *", decisionText);
  await fill("Impact *", "E2E original published impact");
  await click("Save decision");
  await waitNoModals();
  await saveDraft();
  await click("Submit");
  await waitModal("Confirm submission", "alertdialog");
  await scopedClick(
    { role: "alertdialog", name: "Confirm submission" },
    "Submit",
  );
  await waitText("Report submitted");
  await waitNoModals();
}

async function publishAndReopenPeriod(): Promise<void> {
  const session = headSession();
  await loginAsHead(session);
  await open(`/head/report/${LEAD_FORM_FIXTURE.reportId}`, session);
  await waitText("Publish & lock", session);
  await click("Publish & lock", session);
  const publishDialog: Scope = {
    role: "alertdialog",
    name: "Publish & lock report?",
  };
  await waitModal("Publish & lock report?", "alertdialog", session);
  assert.ok(
    (await roleText("alertdialog", "Publish & lock report?", session)).includes(
      "1 of 2 leads haven't submitted yet.",
    ),
  );
  await scopedClick(publishDialog, "Publish anyway", session);
  await waitText("Period published & locked", session);
  await waitNoModals(session);
  await waitText("Reopen period", session);
  await click("Reopen period", session);
  await waitModal("Reopen this period?", "alertdialog", session);
  await scopedClick(
    { role: "alertdialog", name: "Reopen this period?" },
    "Reopen",
    session,
  );
  await waitText("Period reopened", session);
  await waitNoModals(session);
  await openLeadReport();
  await waitText(MINIMAL_CURRENT_TEXT);
  assert.equal(
    refsByRole(await snapshot(), "button", `Add item to ${PRODUCT.name}`)
      .length,
    1,
  );
}

async function editPublishedDecision(decisionText: string): Promise<void> {
  const scope: Scope = { role: "region", name: "Decisions" };
  await expandSupport("Decisions");
  const data = scopeSnapshot(await snapshot(), scope.role, scope.name);
  assert.ok(data.snapshot.includes(decisionText));
  assert.ok(data.snapshot.includes("In published report"));
  const editName = `Edit decision: ${decisionText}`;
  assert.equal(refsByRole(data, "button", editName).length, 1);
  assert.equal(
    refsByRole(data, "button", `Delete decision for ${PRODUCT.name}`).length,
    0,
  );
  await scopedClick(scope, editName);
  await assertModal("Edit decision");
  assert.equal(await value("textbox", "Decision *"), decisionText);
  const impact = "E2E revised published impact";
  await fill("Impact *", impact);
  await click("Save decision");
  await waitNoModals();
  await saveDraft();
  await reload();
  await waitText(MINIMAL_CURRENT_TEXT);
  await expandSupport("Decisions");
  await waitText(impact);
  assert.ok((await roleText("region", "Decisions")).includes(impact));
  await scopedClick(scope, editName);
  await assertModal("Edit decision");
  assert.equal(await value("textbox", "Impact *"), impact);
  await click("Cancel");
  await waitNoModals();
}

async function rejectPublishedItemDeletion(): Promise<void> {
  const record: SlideRecord = {
    kind: "Item",
    parent: PRODUCT,
    text: MINIMAL_CURRENT_TEXT,
  };
  await openSlides();
  await openSlideRecord(record);
  const before = await saveRequestCount();
  await click("Delete");
  await waitModal("Delete item?", "alertdialog");
  await scopedClick({ role: "alertdialog", name: "Delete item?" }, "Delete");
  await waitText(PUBLISHED_RECORD_LOCKED);
  await command([
    "wait",
    "--fn",
    "Array.from(document.getElementsByTagName('div')).some(element => element.getAttribute('role') === 'alertdialog' && element.getAttribute('aria-busy') !== 'true')",
  ]);
  assert.equal(scopeCount(await snapshot(), "alertdialog", "Delete item?"), 1);
  await scopedClick({ role: "alertdialog", name: "Delete item?" }, "Cancel");
  await waitNoModals();
  await persistedReload(record.text);
  await openSlideRecord(record);
  assert.equal(await value("textbox", "Description *"), record.text);
  assert.equal(await saveRequestCount(), before + 1);
  await click("Cancel");
  await waitNoModals();
}

void test("reopened published records retain edit and forbid destructive deletion", async (context) => {
  await prepareE2eData("minimal", context.signal);
  await openLeadReport();
  await waitText(MINIMAL_CURRENT_TEXT);
  const decisionText = "E2E published decision";
  await createPublishedLineageDraft(decisionText);
  await publishAndReopenPeriod();
  await editPublishedDecision(decisionText);
  await rejectPublishedItemDeletion();
});

interface SlideSaveCase {
  readonly kind: SlideRecord["kind"];
  readonly field: string;
  readonly saveLabel: string;
}
const SLIDE_SAVE_CASES: readonly SlideSaveCase[] = [
  { kind: "Item", field: "Description *", saveLabel: "Save item" },
  { kind: "Risk", field: "Risk *", saveLabel: "Save risk" },
  { kind: "Decision", field: "Decision *", saveLabel: "Save decision" },
];

async function createSlideSaveRecord(record: SlideRecord): Promise<void> {
  if (record.kind === "Item")
    await createItem(ACTIVITY, "Current", record.text);
  else if (record.kind === "Risk") await createRisk(ACTIVITY, record.text);
  else await createDecision(ACTIVITY, record.text);
}

async function saveRequestCount(): Promise<number> {
  const data = await command(["network", "requests"]);
  assert.ok(Array.isArray(data.requests), "Expected tracked network requests");
  const requests: readonly unknown[] = data.requests;
  return requests.filter((request) => {
    assert.ok(typeof request === "object" && request !== null);
    const entry = request as Record<string, unknown>;
    assert.equal(typeof entry.url, "string");
    assert.equal(typeof entry.method, "string");
    return (
      entry.method === "POST" &&
      (entry.url as string).includes("reports.saveDraft")
    );
  }).length;
}

for (const entry of SLIDE_SAVE_CASES) {
  void test(`Slides ${entry.kind.toLowerCase()} save failure retains inputs and retries`, async () => {
    const text = `E2E retry ${entry.kind.toLowerCase()}`;
    const record: SlideRecord = { kind: entry.kind, parent: ACTIVITY, text };
    await openLeadReport();
    await createSlideSaveRecord(record);
    await openSlides();
    await openSlideRecord(record);
    await fill(entry.field, `${text} revised`);
    const before = await saveRequestCount();
    await command(["network", "route", SAVE_ROUTE, "--abort"]);
    try {
      await click(entry.saveLabel);
      await waitText(FETCH_FAILURE);
      await command([
        "wait",
        "--fn",
        "Array.from(document.getElementsByTagName('div')).some(element => element.getAttribute('role') === 'dialog' && element.getAttribute('aria-busy') !== 'true')",
      ]);
      assert.ok((await snapshot()).snapshot.includes(FETCH_FAILURE));
      assert.equal(await value("textbox", entry.field), `${text} revised`);
      assert.equal(
        (await command(["is", "enabled", await ref("button", entry.saveLabel)]))
          .enabled,
        true,
      );
      assert.equal(await saveRequestCount(), before + 1);
    } finally {
      await command(["network", "unroute", SAVE_ROUTE]);
    }
    await saveSlide(entry.saveLabel);
    assert.equal(await saveRequestCount(), before + 2);
    await persistedReload(`${text} revised`);
    await openSlideRecord({ ...record, text: `${text} revised` });
    assert.equal(await value("textbox", entry.field), `${text} revised`);
    await click("Cancel");
    await waitNoModals();
  });
}

function disabledRef(
  data: BrowserSnapshot,
  role: string,
  name: string,
): string {
  const matches = refsByRole(data, role, name);
  assert.equal(matches.length, 1, `Expected one disabled ${role}: ${name}`);
  const target = matches.at(0);
  assert.ok(target);
  assert.match(target, /^@e\d+$/);
  const refPattern = new RegExp(String.raw`\bref=${target.slice(1)}\b`);
  const lines = data.snapshot
    .split("\n")
    .filter((line) => refPattern.test(line));
  assert.equal(lines.length, 1);
  const line = lines.at(0) ?? "";
  const start = line.indexOf("[");
  const end = line.indexOf("]", start + 1);
  assert.ok(start !== -1 && end > start);
  assert.ok(
    line
      .slice(start + 1, end)
      .split(",")
      .some((attribute) => attribute.trim() === "disabled"),
  );
  return target;
}

async function clickDisabledButton(name: string): Promise<void> {
  const button = disabledRef(await snapshot(), "button", name);
  const box = await command(["get", "box", button]);
  assert.equal(typeof box.x, "number");
  assert.equal(typeof box.y, "number");
  assert.equal(typeof box.width, "number");
  assert.equal(typeof box.height, "number");
  await command([
    "mouse",
    "move",
    String(Math.round((box.x as number) + (box.width as number) / 2)),
    String(Math.round((box.y as number) + (box.height as number) / 2)),
  ]);
  await command(["mouse", "down", "left"]);
  await command(["mouse", "up", "left"]);
}

async function assertPendingSlide(
  entry: SlideSaveCase,
  modalName: string,
  revised: string,
  before: number,
): Promise<void> {
  await waitText("Saving slide changes…");
  await command([
    "wait",
    "--fn",
    "Array.from(document.getElementsByTagName('div')).some(element => element.getAttribute('role') === 'dialog' && element.getAttribute('aria-busy') === 'true')",
  ]);
  await assertModal(modalName);
  assert.equal(scopeCount(await snapshot(), "alertdialog"), 0);
  assert.equal(await value("textbox", entry.field), revised);
  const data = scopeSnapshot(await snapshot(), "dialog", modalName);
  for (const [role, name] of [
    ["textbox", entry.field],
    ["button", "Cancel"],
    ["button", "Delete"],
    ["button", entry.saveLabel],
  ] as const)
    disabledRef(data, role, name);
  assert.equal(await saveRequestCount(), before);
}

for (const entry of SLIDE_SAVE_CASES) {
  void test(`Slides ${entry.kind.toLowerCase()} pending save blocks dismissal and duplicate submission`, async () => {
    const text = `E2E pending ${entry.kind.toLowerCase()}`;
    const revised = `${text} revised`;
    const record: SlideRecord = { kind: entry.kind, parent: ACTIVITY, text };
    const modalName =
      entry.kind === "Decision"
        ? "Edit decision"
        : `Edit ${entry.kind.toLowerCase()} — ${ACTIVITY.name}`;
    await openLeadReport();
    await createSlideSaveRecord(record);
    await openSlides();
    await openSlideRecord(record);
    await fill(entry.field, revised);
    const before = await saveRequestCount();
    try {
      await setOffline(true);
      await click(entry.saveLabel);
      await assertPendingSlide(entry, modalName, revised, before);
      await command(["press", "Escape"]);
      await assertPendingSlide(entry, modalName, revised, before);
      await clickBackdrop(modalName);
      await assertPendingSlide(entry, modalName, revised, before);
      await clickDisabledButton("Cancel");
      await clickDisabledButton(entry.saveLabel);
      await command(["press", "Control+Enter"]);
      await assertPendingSlide(entry, modalName, revised, before);
    } finally {
      await setOffline(false);
    }
    await waitNotification("Slide record saved");
    await waitNoModals();
    await persistedReload(revised);
    await openSlideRecord({ ...record, text: revised });
    assert.equal(await value("textbox", entry.field), revised);
    assert.equal(await saveRequestCount(), before + 1);
    await click("Cancel");
    await waitNoModals();
  });
}

async function weeklyFill(name: string, text: string): Promise<void> {
  const target = await scopedRef(
    WEEKLY_FORM,
    "textbox",
    new RegExp(`^${name}(?:$| )`),
  );
  if (text === "") {
    await clearTextbox(target);
    return;
  }
  await command(["fill", target, text]);
}

async function weeklyValue(name: string): Promise<unknown> {
  return (
    await command([
      "get",
      "value",
      await scopedRef(WEEKLY_FORM, "textbox", new RegExp(`^${name}(?:$| )`)),
    ])
  ).value;
}

const editWeeklyName = (name: string): string =>
  `Edit weekly fields for ${name}`;

/** Weekly fields stay closed at rest: neither the form nor its inputs render. */
async function assertWeeklyClosed(): Promise<void> {
  await waitClosed(WEEKLY_FORM);
  const data = await snapshot();
  assert.equal(scopeCount(data, "textbox", /^Weekly title(?: |$)/), 0);
  assert.equal(scopeCount(data, "textbox", /^Description(?: |$)/), 0);
}

/** Opens the weekly fields from the Activity header edit control (named by the displayed title). */
async function openWeeklyFields(displayedTitle: string): Promise<void> {
  await click(editWeeklyName(displayedTitle));
  await waitScope(WEEKLY_FORM);
}

/** Save closes the form and returns focus to the edit control, which carries the new displayed title. */
async function saveWeeklyFields(displayedTitle: string): Promise<void> {
  await scopedClick(WEEKLY_FORM, "Save weekly fields");
  await assertWeeklyClosed();
  await assertFocused(editWeeklyName(displayedTitle));
  await saveDraft();
}

async function activityHeader(displayedTitle: string): Promise<string> {
  return scopeSnapshot(
    await snapshot(),
    "article",
    `Activity ${displayedTitle}`,
  ).snapshot;
}

void test("activity weekly title and description open on demand, then save, cancel and reset", async () => {
  const title = "E2E weekly activity";
  const description = "E2E weekly activity description";
  await openLeadReport();
  await waitText(ACTIVITY.name);
  // No weekly input at rest; only Activities carry the edit control.
  await assertWeeklyClosed();
  const rest = await snapshot();
  assert.equal(scopeCount(rest, "button", editWeeklyName(ACTIVITY.name)), 1);
  assert.equal(scopeCount(rest, "button", editWeeklyName(PRODUCT.name)), 0);
  await openWeeklyFields(ACTIVITY.name);
  const titleBefore = await weeklyValue("Weekly title");
  const descriptionBefore = await weeklyValue("Description");
  await weeklyFill("Weekly title", "E2E cancelled title");
  await weeklyFill("Description", "E2E cancelled description");
  await scopedClick(WEEKLY_FORM, "Cancel");
  await assertWeeklyClosed();
  await assertFocused(editWeeklyName(ACTIVITY.name));
  assert.equal(
    (await activityHeader(ACTIVITY.name)).includes("E2E cancelled"),
    false,
  );
  await openWeeklyFields(ACTIVITY.name);
  assert.equal(await weeklyValue("Weekly title"), titleBefore);
  assert.equal(await weeklyValue("Description"), descriptionBefore);
  await weeklyFill("Weekly title", title);
  await weeklyFill("Description", description);
  await saveWeeklyFields(title);
  await persistedReload(title);
  await assertWeeklyClosed();
  // The saved values show as read-only text in the Activity header.
  const header = await activityHeader(title);
  assert.ok(header.includes(title));
  assert.ok(header.includes(description));
  await openWeeklyFields(title);
  assert.equal(await weeklyValue("Weekly title"), title);
  assert.equal(await weeklyValue("Description"), description);
  await scopedClick(WEEKLY_FORM, "Reset to catalogue name");
  assert.equal(await weeklyValue("Weekly title"), "");
  assert.equal(await weeklyValue("Description"), description);
  await saveWeeklyFields(ACTIVITY.name);
  await persistedReload(ACTIVITY.name);
  assert.ok((await activityHeader(ACTIVITY.name)).includes(description));
  await openWeeklyFields(ACTIVITY.name);
  assert.equal(await weeklyValue("Weekly title"), "");
  assert.equal(await weeklyValue("Description"), description);
  await weeklyFill("Description", "");
  assert.equal(await weeklyValue("Description"), "");
  await saveWeeklyFields(ACTIVITY.name);
  await persistedReload(ACTIVITY.name);
  assert.equal(
    (await activityHeader(ACTIVITY.name)).includes(description),
    false,
  );
  await openWeeklyFields(ACTIVITY.name);
  assert.equal(await weeklyValue("Description"), "");
  assert.equal(await weeklyValue("Weekly title"), "");
});

void test("activity weekly fields enforce title and description limits", async () => {
  const longTitle = "T".repeat(200);
  await openLeadReport();
  await waitText(ACTIVITY.name);
  await openWeeklyFields(ACTIVITY.name);
  await weeklyFill("Weekly title", "T".repeat(201));
  await waitText("Weekly title must be 200 characters or fewer.");
  assert.equal(
    await getAttr(
      await scopedRef(WEEKLY_FORM, "textbox", /^Weekly title/),
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
  await weeklyFill("Weekly title", longTitle);
  await weeklyFill("Description", "D".repeat(501));
  await waitText("Description must be 500 characters or fewer.");
  assert.equal(
    await getAttr(
      await scopedRef(WEEKLY_FORM, "textbox", /^Description/),
      "aria-invalid",
    ),
    "true",
  );
  await weeklyFill("Description", "D".repeat(500));
  await saveWeeklyFields(longTitle);
  await persistedReload(longTitle);
  await openWeeklyFields(longTitle);
  assert.equal(await weeklyValue("Weekly title"), longTitle);
  assert.equal(await weeklyValue("Description"), "D".repeat(500));
});
