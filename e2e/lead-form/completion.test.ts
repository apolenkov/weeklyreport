import assert from "node:assert/strict";
import test from "node:test";

import type { ReportAssistantOutcome } from "@customreport/shared";

import { PROD_CRM_360 } from "../../prisma/seeds/simple/seed-simple.ids.js";
import { DEMO_STAGE_ASSIGNMENTS } from "../../prisma/seeds/simple/seed-simple.stages.js";
import { prepareE2eData } from "../setup/reset.js";
import { openLeadReport } from "./access.js";
import {
  command,
  fill,
  findRole,
  getAttr,
  getText,
  getUrl,
  isVisible,
  refsByRole,
  reload,
  snapshot,
  waitText,
} from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import { assertFocused } from "./focus.js";
import {
  ARCHIVED_FILL_FIXTURE,
  LEAD_FORM_FIXTURE,
  roleText,
  saveDraft,
  scopeCount,
  scopedRef,
  scopeSnapshot,
  setOffline,
  waitButton,
  waitClosed,
  waitScope,
} from "./helpers.js";

registerE2eHooks();

const AVAILABILITY_ROUTE = "**/trpc/*ai.availability*";
const SINGLE_AVAILABILITY_ROUTE = "**/trpc/ai.availability?*";
const ASSISTANT_ROUTE = "**/trpc/*leadForm.assistant*";
const DRAFT_ROUTE = "**/trpc/*reports.saveDraft*";
const FILL_ROUTE = "**/trpc/*leadForm.fillFrom*";
const WRITE_ROUTE =
  /reports\.(saveDraft|submit)|leadForm\.(resolvePlan|restorePlan|promotePlan|fillFrom|requestReopen)/u;
const QUESTION = "What is the current product status?";
// The canonical label is styled uppercase; match its AX name with case folding.
const QUESTION_FIELD = /^Your question$/iu;
const SOURCE_NAME = `S1E2E previous period · ${LEAD_FORM_FIXTURE.productName}`;
// Frozen published history includes the demo assignments and the overlay product.
const SOURCE_PRODUCT_COUNT =
  new Set(
    DEMO_STAGE_ASSIGNMENTS.filter(
      (assignment) => assignment.userId === LEAD_FORM_FIXTURE.leadId,
    ).map((assignment) => assignment.projectId),
  ).size + 1;
const ARCHIVED_FILL_HINT =
  "No submitted reports in open periods. Show closed (archived) report periods to see more.";
const ANSWER: ReportAssistantOutcome = {
  kind: "ok",
  answerMarkdown:
    "## E2E grounded answer\n\n- Delivery remains on track.\n- The next commitment is visible.",
  citations: [
    {
      sourceId: "S1",
      reportId: LEAD_FORM_FIXTURE.previousReportId,
      periodLabel: "E2E previous period",
      authorName: LEAD_FORM_FIXTURE.leadName,
      subjectName: LEAD_FORM_FIXTURE.productName,
      recordKind: "item",
    },
  ],
  metadata: { truncated: false, insufficientEvidence: false },
};

function record(value: unknown): Record<string, unknown> {
  assert(typeof value === "object" && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}

async function refFor(role: string, name: string | RegExp): Promise<string> {
  const data = await snapshot();
  const refs = refsByRole(data, role, name);
  const observedNames = Object.values(data.refs)
    .filter((entry) => entry.role === role)
    .map((entry) => entry.name);
  assert.equal(
    refs.length,
    1,
    `Expected one ${role} named ${String(name)}; observed ${JSON.stringify(observedNames)}`,
  );
  const ref = refs.at(0);
  assert(ref);
  return ref;
}

async function clickScoped(
  scope: { role: string; name: string | RegExp },
  role: string,
  name: string,
): Promise<void> {
  await command(["click", await scopedRef(scope, role, name)]);
}

async function valueOf(role: string, name: string | RegExp): Promise<string> {
  const data = await command(["get", "value", await refFor(role, name)]);
  assert.equal(typeof data.value, "string");
  return String(data.value);
}

async function requests(): Promise<Record<string, unknown>[]> {
  const data = await command(["network", "requests"]);
  assert(Array.isArray(data.requests), "Missing captured network requests");
  return data.requests.map(record);
}

async function clearRequests(): Promise<void> {
  await requests();
  await command(["network", "requests", "--clear"]);
}

async function assertNoReportWrites(): Promise<void> {
  const writes = (await requests()).filter(
    (request) =>
      request.method === "POST" &&
      typeof request.url === "string" &&
      WRITE_ROUTE.test(request.url),
  );
  assert.deepEqual(writes, [], "Read-only controls must not write the report");
}

async function assistantRequests(): Promise<Record<string, unknown>[]> {
  return (await requests()).filter(
    (request) =>
      request.method === "POST" &&
      typeof request.url === "string" &&
      request.url.includes("leadForm.assistant"),
  );
}

async function assertSingletonAssistantCalls(count: number): Promise<void> {
  const calls = await assistantRequests();
  assert.equal(calls.length, count);
  for (const request of calls) {
    assert.equal(typeof request.url, "string");
    assert.equal(
      new URL(String(request.url)).pathname,
      "/trpc/leadForm.assistant",
    );
  }
}

async function stubAssistant(outcome: ReportAssistantOutcome): Promise<void> {
  // POST batches are separate from GET report reads. Every assistant URL is
  // fulfilled, so an unexpected mixed mutation batch also cannot reach a provider.
  await command(["network", "unroute", ASSISTANT_ROUTE]);
  await command([
    "network",
    "route",
    ASSISTANT_ROUTE,
    "--body",
    JSON.stringify([{ result: { data: { json: outcome } } }]),
  ]);
}

async function availabilityFailed(): Promise<void> {
  await requests();
  await command(["network", "route", ASSISTANT_ROUTE, "--abort"]);
  await command(["network", "route", AVAILABILITY_ROUTE, "--abort"]);
  await openLeadReport();
  await waitButton("Retry report chat availability check");
  await findRole("button", "Retry report chat availability check", "text");
  const unavailable = await refFor("button", "Report chat unavailable");
  assert.equal(await getAttr(unavailable, "aria-disabled"), "true");
  await command(["network", "unroute", AVAILABILITY_ROUTE]);
  // An availability transport failure may abort a sibling supporting read.
  // Retry it through the UI; no fake report response is used by the chat stub.
  await command([
    "wait",
    "--fn",
    "document.body.innerText.includes('E2E paused work') || Array.from(document.getElementsByTagName('button')).some(button => button.getClientRects().length > 0 && (button.getAttribute('aria-label') ?? button.innerText.trim()) === 'Retry open work')",
  ]);
  const data = await snapshot();
  const retry = refsByRole(data, "button", "Retry open work");
  if (retry.length > 0) {
    assert.equal(retry.length, 1);
    const ref = retry.at(0);
    assert(ref);
    await command(["click", ref]);
  }
  await waitText("E2E paused work");
  await waitText(LEAD_FORM_FIXTURE.currentText);
}

async function routeAvailability(
  availability: "available" | "not_configured",
): Promise<void> {
  await command(["network", "unroute", SINGLE_AVAILABILITY_ROUTE]);
  await command([
    "network",
    "route",
    SINGLE_AVAILABILITY_ROUTE,
    "--body",
    JSON.stringify([{ result: { data: { json: { availability } } } }]),
  ]);
}

async function stubAvailability(
  availability: "available" | "not_configured",
): Promise<void> {
  await routeAvailability(availability);
  await findRole("button", "Retry report chat availability check", "click");
  if (availability === "not_configured") {
    await command([
      "wait",
      "--fn",
      "!Array.from(document.getElementsByTagName('button')).some(button => button.getAttribute('aria-label') === 'Retry report chat availability check')",
    ]);
  }
  await waitButton(
    availability === "available"
      ? "Open report chat"
      : "Report chat unavailable",
  );
  await findRole(
    "button",
    availability === "available"
      ? "Open report chat"
      : "Report chat unavailable",
    "text",
  );
  const calls = (await requests()).filter(
    (request) =>
      typeof request.url === "string" &&
      request.url.includes("ai.availability"),
  );
  const last = calls.at(-1);
  assert(last && typeof last.url === "string");
  assert.equal(new URL(last.url).pathname, "/trpc/ai.availability");
}

async function openConfiguredChat(): Promise<void> {
  await availabilityFailed();
  await stubAvailability("available");
  await clearRequests();
  await findRole("button", "Open report chat", "click");
  await waitScope({ role: "dialog", name: "Report chat" });
  await findRole("dialog", "Report chat", "text");
}

async function askQuestion(question = QUESTION): Promise<void> {
  await fill("Your question", question);
  await findRole("button", "Ask report chat", "click");
}

async function signOutToLogin(): Promise<void> {
  await findRole("button", "Sign out", "click");
  await command(["wait", "--url", "http://localhost:3000/"]);
  await waitText("Lead");
  await waitScope({ role: "list", name: "Sign in as" });
  await findRole("link", "Lead", "text");
}

async function addMarker(text: string): Promise<void> {
  await findRole(
    "button",
    `Add item to ${LEAD_FORM_FIXTURE.activityName}`,
    "click",
  );
  await fill("Description *", text);
  await findRole("button", "Save update", "click");
  await waitButton(`Update progress for ${text}`);
  await findRole("button", `Update progress for ${text}`, "text");
  await saveDraft();
}

async function openFillConfirmation(): Promise<{ role: string; name: RegExp }> {
  await findRole("button", "Fill from most recent submitted period", "click");
  const name = /^Fill from .+\?$/u;
  const data = await waitScope({ role: "alertdialog", name });
  assert.equal(scopeCount(data, "alertdialog", name), 1);
  assert.match(
    scopeSnapshot(data, "alertdialog", name).snapshot,
    /Priorities will NOT be filled\./u,
  );
  return { role: "alertdialog", name };
}

async function expandFilledProduct(): Promise<void> {
  const scope = {
    role: "article",
    name: `Product ${LEAD_FORM_FIXTURE.productName}`,
  };
  await waitScope(scope);
  await command(["click", await scopedRef(scope, "button", "+1 more")]);
}

async function createUnsavedRisk(): Promise<void> {
  await command(["network", "route", DRAFT_ROUTE, "--abort"]);
  await findRole("button", "+ Add Risk", "click");
  await waitScope({ role: "dialog", name: /^Add Risk — /u });
  await command([
    "select",
    await refFor("combobox", "Parent"),
    LEAD_FORM_FIXTURE.activityName,
  ]);
  await fill("Risk *", "E2E unsaved fill risk");
  await fill("Impact *", "E2E unsaved fill impact");
  await fill("Mitigation *", "E2E unsaved fill mitigation");
  await findRole("button", "Save risk", "click");
  await waitButton("Retry saving draft");
  await findRole("button", "Retry saving draft", "text");
  assert.match((await snapshot()).snapshot, /E2E unsaved fill risk/u);
}

async function requestOverwrite(): Promise<void> {
  const confirmation = await openFillConfirmation();
  await clickScoped(confirmation, "button", "Replace & Fill");
  await waitScope({ role: "alertdialog", name: "Overwrite unsaved changes?" });
  await findRole("alertdialog", "Overwrite unsaved changes?", "text");
}

async function focusMissingCurrent(): Promise<void> {
  const expectedHref = `#add:product:${PROD_CRM_360}`;
  const readiness = scopeSnapshot(
    await snapshot(),
    "region",
    "Before you submit",
  );
  const matchingLinks: string[] = [];
  for (const ref of refsByRole(readiness, "link")) {
    if ((await getAttr(ref, "href")) === expectedHref) matchingLinks.push(ref);
  }
  assert.equal(matchingLinks.length, 1);
  const link = matchingLinks.at(0);
  assert(link);
  assert.equal(
    await getText(link),
    "Project CRM-Customer 360 needs at least one Current Week item.",
  );
  await command(["click", link]);
  const buttonName = "Add item to CRM-Customer 360";
  await command([
    "wait",
    "--fn",
    `document.activeElement?.getAttribute('aria-label') === ${JSON.stringify(buttonName)}`,
  ]);
  await assertFocused(buttonName);
  assert.equal(new URL(await getUrl()).hash, expectedHref);
  assert.equal(
    await isVisible(
      await scopedRef(
        { role: "article", name: "Product CRM-Customer 360" },
        "button",
        buttonName,
      ),
    ),
    true,
  );
}

void test("completion guidance jumps to missing work", async () => {
  await openLeadReport();
  await clearRequests();
  assert.match(
    await roleText("region", "Before you submit"),
    /Complete the items below before submitting\./u,
  );
  await findRole("heading", "Fix before submitting", "text");
  await findRole(
    "link",
    `Update progress for "${LEAD_FORM_FIXTURE.carriedText}".`,
    "click",
  );
  await assertFocused(`Update progress for ${LEAD_FORM_FIXTURE.carriedText}`);
  assert.match(await getUrl(), /#confirm:current:/u);
  assert.match(
    await roleText(
      "article",
      `Product ${LEAD_FORM_FIXTURE.carriedProductName}`,
    ),
    /Перенёс A\/B тесты на новую инфраструктуру/u,
  );
  await focusMissingCurrent();
  const data = await snapshot();
  const promotionRole = "DisclosureTriangle";
  const promotionName = /^When you submit:/u;
  assert.equal(
    scopeCount(data, promotionRole, promotionName),
    1,
    "Seed-owned unset stages must produce the disclosure",
  );
  const promotion = scopeSnapshot(data, promotionRole, promotionName);
  const quotedName = /- DisclosureTriangle ("(?:\\.|[^"\\])*")/u.exec(
    promotion.snapshot,
  )?.[1];
  assert(quotedName);
  const name: unknown = JSON.parse(quotedName);
  assert(typeof name === "string");
  assert.match(
    await roleText(promotionRole, name),
    /unset statuses? will be marked On Track/u,
  );
  assert.doesNotMatch(data.snapshot, /heading "Stages \(/u);
  await findRole(promotionRole, name, "click");
  assert.match((await snapshot()).snapshot, /Маркетинговый портал \/ DevOps/u);
  await findRole("link", "Risks & decisions", "click");
  assert.match(await getUrl(), /#report-details$/u);
  await findRole("button", "Expand Risks & Blockers", "click");
  await findRole("button", "Expand Decisions", "click");
  await findRole("region", "Risks & Blockers", "text");
  await findRole("region", "Decisions", "text");
  const submit = await scopedRef(
    { role: "region", name: "Before you submit" },
    "button",
    "Submit report",
  );
  const disabled = await command(["is", "enabled", submit]);
  assert.equal(disabled.enabled, false);
  await assertNoReportWrites();
});

void test("Fill from previous handles cancel and persists canonical replacement", async () => {
  await openLeadReport();
  await addMarker("E2E fill replacement marker");
  await clearRequests();
  const confirmation = await openFillConfirmation();
  await clickScoped(confirmation, "button", "Cancel");
  await waitClosed(confirmation);
  await assertFocused("Fill from most recent submitted period");
  await findRole(
    "button",
    "Update progress for E2E fill replacement marker",
    "text",
  );
  await assertNoReportWrites();
  const replacement = await openFillConfirmation();
  await clickScoped(replacement, "button", "Replace & Fill");
  await waitText("Form filled from selected period");
  await reload();
  await expandFilledProduct();
  await waitButton(`Update progress for ${LEAD_FORM_FIXTURE.previousText}`);
  const data = await snapshot();
  assert.doesNotMatch(data.snapshot, /E2E fill replacement marker/u);
  assert.doesNotMatch(data.snapshot, /E2E own reviewer record feedback/u);
  await findRole(
    "button",
    `Update progress for ${LEAD_FORM_FIXTURE.previousText}`,
    "text",
  );
  await clickScoped({ role: "group", name: "View mode" }, "link", "Slides");
  await waitText("Document");
  await findRole("button", "Document", "click");
  const slide = await snapshot();
  const expanded = refsByRole(
    slide,
    "button",
    /^Expand full details for Completed: Закрыли спринтовые цели команды/u,
  );
  assert.equal(expanded.length, 1);
  const expand = expanded.at(0);
  assert(expand);
  await command(["click", expand]);
  const editRefs = refsByRole(
    await snapshot(),
    "button",
    /^Edit Completed: Закрыли спринтовые цели команды/u,
  );
  assert.equal(editRefs.length, 1);
  const edit = editRefs.at(0);
  assert(edit);
  await command(["click", edit]);
  await waitScope({ role: "dialog", name: /^Edit Item — /u });
  assert.equal(
    await valueOf(
      "combobox",
      "Priority rank (optional — leave blank if not a priority)",
    ),
    "",
  );
  assert.equal(await valueOf("textbox", "Next step (optional)"), "");
  await findRole("button", "Cancel", "click");
});

void test("Fill from pending replacement blocks dismissal and duplicate writes", async () => {
  await openLeadReport();
  await saveDraft();
  await clearRequests();
  const confirmation = await openFillConfirmation();
  await setOffline(true);
  try {
    await clickScoped(confirmation, "button", "Replace & Fill");
    await waitButton("Replace & Fill", { busy: true });
    for (const name of ["Cancel", "Replace & Fill"]) {
      const ref = await scopedRef(confirmation, "button", name);
      assert.notEqual(await getAttr(ref, "disabled"), null);
    }
    const confirm = await scopedRef(confirmation, "button", "Replace & Fill");
    assert.equal(await getAttr(confirm, "aria-busy"), "true");
    await command(["press", "Escape"]);
    assert.equal(
      scopeCount(await snapshot(), "alertdialog", confirmation.name),
      1,
    );
    await command(["press", "Enter"]);
    await assertNoReportWrites();
  } finally {
    await setOffline(false);
  }
  await waitText("Form filled from selected period");
  const calls = (await requests()).filter(
    (request) =>
      request.method === "POST" &&
      typeof request.url === "string" &&
      request.url.includes("leadForm.fillFrom"),
  );
  assert.equal(calls.length, 1);
  await reload();
  await expandFilledProduct();
  await waitButton(`Update progress for ${LEAD_FORM_FIXTURE.previousText}`);
  await findRole(
    "button",
    `Update progress for ${LEAD_FORM_FIXTURE.previousText}`,
    "text",
  );
});

void test("Fill from previous dirty overwrite retains input and recovers from failure", async () => {
  await openLeadReport();
  await createUnsavedRisk();
  await clearRequests();
  await requestOverwrite();
  await clickScoped(
    { role: "alertdialog", name: "Overwrite unsaved changes?" },
    "button",
    "Cancel",
  );
  assert.match((await snapshot()).snapshot, /E2E unsaved fill risk/u);
  assert.equal(
    (await requests()).filter(
      (request) =>
        typeof request.url === "string" &&
        request.url.includes("leadForm.fillFrom"),
    ).length,
    0,
  );
  await command([
    "network",
    "route",
    FILL_ROUTE,
    "--body",
    JSON.stringify([
      {
        error: {
          json: {
            message: "E2E fill interrupted",
            code: -32_603,
            data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
          },
        },
      },
    ]),
  ]);
  await requestOverwrite();
  await clickScoped(
    { role: "alertdialog", name: "Overwrite unsaved changes?" },
    "button",
    "Overwrite & Fill",
  );
  await waitText("E2E fill interrupted");
  assert.match((await snapshot()).snapshot, /E2E unsaved fill risk/u);
  const failedCalls = (await requests()).filter(
    (request) =>
      typeof request.url === "string" &&
      request.url.includes("leadForm.fillFrom"),
  );
  assert.equal(
    failedCalls.length,
    1,
    "The explicit overwrite must attempt the fill mutation",
  );
  await command(["network", "unroute", FILL_ROUTE]);
  await requestOverwrite();
  await clickScoped(
    { role: "alertdialog", name: "Overwrite unsaved changes?" },
    "button",
    "Overwrite & Fill",
  );
  await waitText("Form filled from selected period");
  await command(["network", "unroute", DRAFT_ROUTE]);
  await reload();
  await expandFilledProduct();
  await waitButton(`Update progress for ${LEAD_FORM_FIXTURE.previousText}`);
  assert.doesNotMatch((await snapshot()).snapshot, /E2E unsaved fill risk/u);
  await findRole(
    "button",
    `Update progress for ${LEAD_FORM_FIXTURE.previousText}`,
    "text",
  );
});

void test("past-report picker searches and restores focus without changing the draft", async () => {
  await openLeadReport();
  await clearRequests();
  await findRole("switch", "Show closed (archived) report periods", "click");
  await findRole("button", "Choose past report to fill from", "click");
  await waitScope({ role: "region", name: "Past reports" });
  await findRole("region", "Past reports", "text");
  const initial = await snapshot();
  const latest = refsByRole(initial, "button", /Latest submitted/u);
  assert.equal(latest.length, 1);
  const latestRef = latest.at(0);
  assert(latestRef);
  assert.equal(
    (await getText(latestRef)).split("\n").at(-1),
    `${SOURCE_PRODUCT_COUNT} products · 2 items · 0 risks`,
  );
  const pickerData = scopeSnapshot(initial, "region", "Past reports");
  const older = Object.entries(pickerData.refs)
    .filter(
      ([, entry]) =>
        entry.role === "button" && !entry.name?.includes("Latest submitted"),
    )
    .at(-1);
  assert(older?.[1].name, "Archived seed must provide a distinct older source");
  const olderWeek = older[1].name.split(" · ").at(0);
  assert(olderWeek);
  await fill("Search reports", olderWeek);
  const filtered = await snapshot();
  assert.equal(refsByRole(filtered, "button", /Latest submitted/u).length, 0);
  assert.match(
    scopeSnapshot(filtered, "region", "Past reports").snapshot,
    /Archived/u,
  );
  await fill("Search reports", "no matching E2E period");
  await waitText("No reports match your search.");
  await command(["press", "Escape"]);
  await findRole("button", "Choose past report to fill from", "click");
  await waitScope({ role: "region", name: "Past reports" });
  assert.equal(await valueOf("textbox", "Search reports"), "");
  const picker = { role: "region", name: "Past reports" };
  const source = await scopedRef(
    picker,
    "button",
    initial.refs[latestRef.slice(1)]?.name ?? "",
  );
  await command(["click", source]);
  const confirmation = { role: "alertdialog", name: /^Fill from .+\?$/u };
  await waitScope(confirmation);
  assert.equal(
    scopeCount(await snapshot(), "alertdialog", /^Fill from .+\?$/u),
    1,
  );
  await findRole("button", "Cancel", "click");
  await waitClosed(confirmation);
  await assertFocused("Choose past report to fill from");
  await findRole("button", "Choose past report to fill from", "click");
  await waitScope({ role: "region", name: "Past reports" });
  await fill("Search reports", "no matching E2E period");
  await findRole("heading", "My Report", "click");
  await waitClosed({ role: "region", name: "Past reports" });
  assert.equal(scopeCount(await snapshot(), "region", "Past reports"), 0);
  await findRole("button", "Choose past report to fill from", "click");
  await waitScope({ role: "region", name: "Past reports" });
  assert.equal(await valueOf("textbox", "Search reports"), "");
  await fill("Search reports", "no matching E2E period");
  await findRole("button", "Choose past report to fill from", "click");
  await waitClosed({ role: "region", name: "Past reports" });
  await findRole("button", "Choose past report to fill from", "click");
  await waitScope({ role: "region", name: "Past reports" });
  assert.equal(await valueOf("textbox", "Search reports"), "");
  await command(["press", "Escape"]);
  await findRole(
    "button",
    `Update progress for ${LEAD_FORM_FIXTURE.carriedText}`,
    "text",
  );
  await assertNoReportWrites();
});

void test("published lineage disables Fill from without a write", async () => {
  await openLeadReport();
  const formName = `Current week update for ${LEAD_FORM_FIXTURE.productName}`;
  await clickScoped(
    { role: "article", name: `Product ${LEAD_FORM_FIXTURE.productName}` },
    "button",
    `Plan this work: ${LEAD_FORM_FIXTURE.previousText}`,
  );
  await findRole("form", formName, "text");
  await findRole("button", "Save update", "click");
  await waitClosed({ role: "form", name: formName });
  await saveDraft();
  await reload();
  await waitButton("Fill from most recent submitted period");
  await clearRequests();
  for (const name of [
    "Fill from most recent submitted period",
    "Choose past report to fill from",
  ]) {
    const ref = await refFor("button", name);
    assert.equal(await getAttr(ref, "aria-disabled"), "true");
    await command(["click", ref]);
  }
  assert.equal(
    scopeCount(await snapshot(), "alertdialog", /^Fill from .+\?$/u),
    0,
  );
  await assertNoReportWrites();
});

void test("Fill from without submitted history explains the disabled action", async (context) => {
  await prepareE2eData("minimal", context.signal);
  await openLeadReport();
  await waitText("Minimal editable report item");
  await clearRequests();
  const fillRef = await refFor(
    "button",
    "Fill from most recent submitted period",
  );
  assert.equal(await getAttr(fillRef, "aria-disabled"), "true");
  await command(["hover", fillRef]);
  await waitText("No submitted past report to fill from.");
  await command(["click", fillRef]);
  assert.equal(
    scopeCount(await snapshot(), "alertdialog", /^Fill from .+\?$/u),
    0,
  );
  await findRole("button", "Choose past report to fill from", "click");
  await waitScope({ role: "region", name: "Past reports" });
  assert.match(
    await roleText("region", "Past reports"),
    /No submitted past reports found\./u,
  );
  assert.equal(
    refsByRole(await snapshot(), "textbox", "Search reports").length,
    0,
  );
  await command(["press", "Escape"]);
  await assertNoReportWrites();
});

void test("archived-only history explains Fill from and preserves the draft after cancellation", async (context) => {
  await prepareE2eData("minimal", context.signal, "archived-fill-only");
  await openLeadReport();
  const current = "Update progress for Minimal editable report item";
  await waitButton(current);
  await clearRequests();
  const archiveSwitch = "Show closed (archived) report periods";
  assert.equal(
    await getAttr(await refFor("switch", archiveSwitch), "aria-checked"),
    "false",
  );
  const copy = "Fill from most recent submitted period";
  const picker = "Choose past report to fill from";
  assert.equal(
    await getAttr(await refFor("button", copy), "aria-disabled"),
    "true",
  );
  const choose = await refFor("button", picker);
  assert.equal(await getAttr(choose, "aria-disabled"), null);
  assert.equal(await getAttr(choose, "disabled"), null);
  await command(["click", choose]);
  await waitScope({ role: "region", name: "Past reports" });
  await waitText(ARCHIVED_FILL_HINT);
  assert.equal(
    (await roleText("region", "Past reports")).trim(),
    ARCHIVED_FILL_HINT,
  );
  assert.equal(
    refsByRole(
      scopeSnapshot(await snapshot(), "region", "Past reports"),
      "button",
    ).length,
    0,
  );
  await command(["press", "Escape"]);
  await waitClosed({ role: "region", name: "Past reports" });
  await findRole("switch", archiveSwitch, "click");
  assert.equal(
    await getAttr(await refFor("switch", archiveSwitch), "aria-checked"),
    "true",
  );
  assert.equal(
    await getAttr(await refFor("button", copy), "aria-disabled"),
    null,
  );
  await findRole("button", picker, "click");
  await waitScope({ role: "region", name: "Past reports" });
  await waitText("Latest submitted");
  const past = scopeSnapshot(await snapshot(), "region", "Past reports");
  const sources = refsByRole(past, "button");
  assert.equal(sources.length, 1);
  const source = sources.at(0);
  assert(source);
  const sourceName = await getText(source);
  assert(sourceName.includes(ARCHIVED_FILL_FIXTURE.weekLabel));
  assert.match(sourceName, /Archived/u);
  assert.match(sourceName, /Latest submitted/u);
  await command(["click", source]);
  const confirmation = {
    role: "alertdialog",
    name: `Fill from ${ARCHIVED_FILL_FIXTURE.weekLabel}?`,
  };
  await waitText(confirmation.name);
  await waitScope(confirmation);
  assert.equal(
    scopeCount(await snapshot(), confirmation.role, confirmation.name),
    1,
  );
  await clickScoped(confirmation, "button", "Cancel");
  await waitClosed(confirmation);
  await assertFocused(picker);
  await findRole("button", current, "text");
  await assertNoReportWrites();
  await reload();
  await waitButton(current);
  assert.equal(
    await getAttr(await refFor("switch", archiveSwitch), "aria-checked"),
    "false",
  );
  await findRole("button", picker, "click");
  await waitScope({ role: "region", name: "Past reports" });
  await waitText(ARCHIVED_FILL_HINT);
  await command(["press", "Escape"]);
  await waitClosed({ role: "region", name: "Past reports" });
  await findRole("switch", archiveSwitch, "click");
  assert.equal(
    await getAttr(await refFor("switch", archiveSwitch), "aria-checked"),
    "true",
  );
  await findRole("button", picker, "click");
  await waitScope({ role: "region", name: "Past reports" });
  await waitText("Latest submitted");
  const reloaded = refsByRole(
    scopeSnapshot(await snapshot(), "region", "Past reports"),
    "button",
  );
  assert.equal(reloaded.length, 1);
  const sameSource = reloaded.at(0);
  assert(sameSource);
  assert.equal(await getText(sameSource), sourceName);
  await command(["press", "Escape"]);
  await findRole("button", current, "text");
  await assertNoReportWrites();
});

void test("report chat availability and retry stay read-only", async () => {
  await availabilityFailed();
  await clearRequests();
  await findRole("button", "Report chat unavailable", "click");
  assert.equal(scopeCount(await snapshot(), "dialog", "Report chat"), 0);
  assert.equal((await assistantRequests()).length, 0);
  await stubAvailability("not_configured");
  const unavailable = await refFor("button", "Report chat unavailable");
  assert.equal(await getAttr(unavailable, "aria-disabled"), "true");
  await command(["hover", unavailable]);
  await waitText(
    "Report chat is unavailable until an administrator configures AI",
  );
  await findRole("button", "Report chat unavailable", "click");
  assert.equal(scopeCount(await snapshot(), "dialog", "Report chat"), 0);
  assert.equal((await assistantRequests()).length, 0);
  await assertNoReportWrites();
});

void test("report chat checking availability blocks opening until the check resumes", async () => {
  await availabilityFailed();
  await clearRequests();
  await routeAvailability("available");
  await setOffline(true);
  try {
    await findRole("button", "Retry report chat availability check", "click");
    await waitButton("Checking report chat availability");
    const checking = await refFor(
      "button",
      "Checking report chat availability",
    );
    assert.equal(await getAttr(checking, "aria-busy"), "true");
    assert.equal(await getAttr(checking, "aria-disabled"), "true");
    await command(["click", checking]);
    assert.equal(scopeCount(await snapshot(), "dialog", "Report chat"), 0);
    const availabilityCalls = (await requests()).filter(
      (request) =>
        typeof request.url === "string" &&
        request.url.includes("ai.availability"),
    );
    assert.equal(availabilityCalls.length, 0);
    assert.equal((await assistantRequests()).length, 0);
    await assertNoReportWrites();
  } finally {
    await setOffline(false);
  }
  await waitButton("Open report chat");
  await findRole("button", "Open report chat", "text");
  await findRole("button", "Open report chat", "click");
  await waitScope({ role: "dialog", name: "Report chat" });
  await findRole("dialog", "Report chat", "text");
  assert.equal((await assistantRequests()).length, 0);
  await assertNoReportWrites();
});

void test("report chat searching disables input and prevents duplicate questions", async () => {
  await openConfiguredChat();
  await stubAssistant(ANSWER);
  await fill("Your question", QUESTION);
  await setOffline(true);
  try {
    await findRole("button", "Ask report chat", "click");
    await waitButton("Searching reports");
    const search = await refFor("button", "Searching reports");
    assert.notEqual(await getAttr(search, "disabled"), null);
    const question = await refFor("textbox", QUESTION_FIELD);
    assert.notEqual(await getAttr(question, "disabled"), null);
    assert.equal(await getAttr(question, "aria-busy"), "true");
    await waitText("Reviewing your report context…");
    await command(["press", "Enter"]);
    assert.equal(await valueOf("textbox", QUESTION_FIELD), QUESTION);
    await assertSingletonAssistantCalls(0);
    await assertNoReportWrites();
  } finally {
    await setOffline(false);
  }
  await waitScope({ role: "heading", name: "E2E grounded answer" });
  await findRole("heading", "E2E grounded answer", "text");
  const question = await refFor("textbox", QUESTION_FIELD);
  assert.equal(await getAttr(question, "disabled"), null);
  assert.equal(await getAttr(question, "aria-busy"), "false");
  await findRole("button", "Ask report chat", "text");
  await assertSingletonAssistantCalls(1);
  await assertNoReportWrites();
});

void test("report chat questions, clarification, retry and sources stay read-only", async () => {
  await openConfiguredChat();
  const ask = await command([
    "is",
    "enabled",
    await refFor("button", "Ask report chat"),
  ]);
  assert.equal(ask.enabled, false);
  await fill("Your question", " ");
  assert.equal(
    (
      await command([
        "is",
        "enabled",
        await refFor("button", "Ask report chat"),
      ])
    ).enabled,
    false,
  );
  const question = await refFor("textbox", QUESTION_FIELD);
  assert.equal(await getAttr(question, "maxlength"), "2000");
  await fill("Your question", "x".repeat(2001));
  assert.equal((await valueOf("textbox", QUESTION_FIELD)).length, 2000);
  await stubAssistant({
    kind: "clarification_required",
    options: [
      { label: LEAD_FORM_FIXTURE.productName, token: "e2e-resolution-token" },
    ],
  });
  await askQuestion();
  await waitText(
    "I found more than one matching entity. Which one should I use?",
  );
  await stubAssistant({ kind: "provider_unavailable" });
  await findRole("button", LEAD_FORM_FIXTURE.productName, "click");
  await waitText("The AI service is temporarily unavailable.");
  assert.equal(await valueOf("textbox", QUESTION_FIELD), QUESTION);
  await stubAssistant(ANSWER);
  await findRole("button", "Try again", "click");
  await waitText("E2E grounded answer");
  await findRole("heading", "E2E grounded answer", "text");
  const answer = await roleText("dialog", "Report chat");
  assert.match(answer, /Delivery remains on track\./u);
  assert.match(answer, /The next commitment is visible\./u);
  const sources = await snapshot();
  assert.equal(
    scopeCount(scopeSnapshot(sources, "dialog", "Report chat"), "listitem") >=
      2,
    true,
  );
  const source = await refFor("link", SOURCE_NAME);
  assert.equal(
    await getAttr(source, "href"),
    `/lead/report/${LEAD_FORM_FIXTURE.previousReportId}`,
  );
  await assertSingletonAssistantCalls(3);
  const clarification = (await assistantRequests()).at(1);
  assert(clarification && typeof clarification.postData === "string");
  const batch = record(JSON.parse(clarification.postData) as unknown);
  const input = record(record(batch["0"]).json);
  assert.equal(input.question, QUESTION);
  assert.deepEqual(input.resolutionTokens, ["e2e-resolution-token"]);
  await assertNoReportWrites();
  await findRole("button", "Close", "click");
  await waitClosed({ role: "dialog", name: "Report chat" });
  await findRole("button", "Open report chat", "click");
  await waitScope({ role: "dialog", name: "Report chat" });
  await waitText("E2E grounded answer");
  await findRole("heading", "E2E grounded answer", "text");
  assert.equal(await valueOf("textbox", QUESTION_FIELD), QUESTION);
  await command(["click", await refFor("link", SOURCE_NAME)]);
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.previousReportId}`,
  ]);
  await waitClosed({ role: "dialog", name: "Report chat" });
  await waitText("Read-only report and status context.");
  await assertNoReportWrites();
  await findRole("button", "Open report chat", "click");
  await waitScope({ role: "dialog", name: "Report chat" });
  await waitText("E2E grounded answer");
  await findRole("heading", "E2E grounded answer", "text");
  assert.equal(await valueOf("textbox", QUESTION_FIELD), QUESTION);
});

void test("report chat reload clears its exchange while the saved draft persists", async () => {
  await openLeadReport();
  await addMarker("E2E persisted chat marker");
  await command(["network", "route", AVAILABILITY_ROUTE, "--abort"]);
  await reload();
  await waitButton("Retry report chat availability check");
  await findRole("button", "Retry report chat availability check", "text");
  await command(["network", "unroute", AVAILABILITY_ROUTE]);
  await stubAvailability("available");
  await command(["network", "route", ASSISTANT_ROUTE, "--abort"]);
  await clearRequests();
  await findRole("button", "Open report chat", "click");
  await waitScope({ role: "dialog", name: "Report chat" });
  await stubAssistant(ANSWER);
  await askQuestion();
  await waitText("E2E grounded answer");
  await findRole("heading", "E2E grounded answer", "text");
  await assertNoReportWrites();
  await command(["network", "unroute", SINGLE_AVAILABILITY_ROUTE]);
  await command(["network", "route", AVAILABILITY_ROUTE, "--abort"]);
  await reload();
  await waitText("E2E persisted chat marker");
  await waitButton("Retry report chat availability check");
  await findRole("button", "Retry report chat availability check", "text");
  await command(["network", "unroute", AVAILABILITY_ROUTE]);
  await stubAvailability("available");
  await findRole("button", "Open report chat", "click");
  await waitScope({ role: "dialog", name: "Report chat" });
  assert.equal(await valueOf("textbox", QUESTION_FIELD), "");
  assert.equal(
    scopeCount(await snapshot(), "heading", "E2E grounded answer"),
    0,
  );
  await assertNoReportWrites();
});

for (const identity of ["Lead", "Head"]) {
  void test(`report chat sign-out through ${identity} clears the exchange`, async () => {
    await openConfiguredChat();
    await stubAssistant(ANSWER);
    await askQuestion();
    await waitText("E2E grounded answer");
    await findRole("heading", "E2E grounded answer", "text");
    await findRole("button", "Close", "click");
    await waitClosed({ role: "dialog", name: "Report chat" });
    await command(["network", "unroute", SINGLE_AVAILABILITY_ROUTE]);
    await command(["network", "route", AVAILABILITY_ROUTE, "--abort"]);
    await signOutToLogin();
    await findRole("link", identity, "click");
    if (identity === "Head") {
      await command(["wait", "--url", "**/head/dashboard**"]);
      await waitButton("Sign out");
      await signOutToLogin();
      await findRole("link", "Lead", "click");
    }
    await waitText("My Report");
    await waitButton("Retry report chat availability check");
    await findRole("button", "Retry report chat availability check", "text");
    await command(["network", "unroute", AVAILABILITY_ROUTE]);
    await stubAvailability("available");
    await findRole("button", "Open report chat", "click");
    await waitScope({ role: "dialog", name: "Report chat" });
    assert.equal(await valueOf("textbox", QUESTION_FIELD), "");
    assert.equal(
      scopeCount(await snapshot(), "heading", "E2E grounded answer"),
      0,
    );
    await assertSingletonAssistantCalls(1);
    await assertNoReportWrites();
  });
}

for (const warning of [
  {
    title: "Showing a bounded result",
    metadata: { truncated: true, insufficientEvidence: false },
  },
  {
    title: "Some evidence is insufficient",
    metadata: { truncated: false, insufficientEvidence: true },
  },
]) {
  void test(`report chat ${warning.title.toLowerCase()} explains its evidence`, async () => {
    await openConfiguredChat();
    assert.equal(ANSWER.kind, "ok");
    await stubAssistant({ ...ANSWER, metadata: warning.metadata });
    await askQuestion();
    await waitText(warning.title);
    await waitText("E2E grounded answer");
    await findRole("heading", "E2E grounded answer", "text");
    const source = await refFor("link", SOURCE_NAME);
    assert.equal(
      await getAttr(source, "href"),
      `/lead/report/${LEAD_FORM_FIXTURE.previousReportId}`,
    );
    await assertSingletonAssistantCalls(1);
    await assertNoReportWrites();
  });
}

const RECOVERIES = [
  {
    outcome: { kind: "invalid_plan" },
    action: "Edit question",
    message: "I could not turn that into a safe report search.",
    retry: false,
  },
  {
    outcome: { kind: "ai_not_configured" },
    action: "Edit question",
    message: "The report assistant is not configured yet.",
    retry: false,
  },
  {
    outcome: { kind: "no_results" },
    action: "Ask another question",
    message: "No matching report records were found",
    retry: false,
  },
  {
    outcome: { kind: "result_set_too_large" },
    action: "Narrow question",
    message: "That question matches too many records.",
    retry: false,
  },
  {
    outcome: { kind: "semantic_index_pending" },
    action: "Check again",
    message: "The semantic index is still catching up.",
    retry: true,
  },
  {
    outcome: { kind: "provider_unavailable" },
    action: "Try again",
    message: "The AI service is temporarily unavailable.",
    retry: true,
  },
  {
    outcome: { kind: "resource_limited", retryAfterSeconds: 1 },
    action: "Try again",
    message: "The report assistant is busy.",
    retry: true,
  },
] as const satisfies readonly {
  outcome: ReportAssistantOutcome;
  action: string;
  message: string;
  retry: boolean;
}[];

for (const recovery of RECOVERIES) {
  void test(`report chat ${recovery.outcome.kind} offers the correct read-only recovery`, async () => {
    await openConfiguredChat();
    await stubAssistant(recovery.outcome);
    await askQuestion();
    await waitText(recovery.message);
    await findRole("button", recovery.action, "text");
    assert.equal(await valueOf("textbox", QUESTION_FIELD), QUESTION);
    if (recovery.retry) await stubAssistant(ANSWER);
    await findRole("button", recovery.action, "click");
    if (recovery.retry) {
      await waitText("E2E grounded answer");
      await findRole("heading", "E2E grounded answer", "text");
      await assertSingletonAssistantCalls(2);
    } else {
      await command([
        "wait",
        "--fn",
        "document.activeElement?.getAttribute('name') === 'question'",
      ]);
      await assertSingletonAssistantCalls(1);
    }
    assert.equal(await valueOf("textbox", QUESTION_FIELD), QUESTION);
    await assertNoReportWrites();
  });
}

void test("report chat transport failure offers the correct read-only recovery", async () => {
  await openConfiguredChat();
  await command(["network", "route", ASSISTANT_ROUTE, "--abort"]);
  await askQuestion();
  await waitText("The assistant could not complete that search.");
  assert.equal(await valueOf("textbox", QUESTION_FIELD), QUESTION);
  await stubAssistant(ANSWER);
  await findRole("button", "Try again", "click");
  await waitText("E2E grounded answer");
  await findRole("heading", "E2E grounded answer", "text");
  await assertSingletonAssistantCalls(2);
  await assertNoReportWrites();
});

void test("report chat provider rate limit offers the correct read-only recovery", async () => {
  await openConfiguredChat();
  await stubAssistant({
    kind: "provider_unavailable",
    rateLimit: { retryAfterSeconds: 1 },
  });
  await askQuestion();
  await waitText(
    "The AI provider reached its rate limit. Try again in about 1 second.",
  );
  assert.equal(await valueOf("textbox", QUESTION_FIELD), QUESTION);
  await stubAssistant(ANSWER);
  await findRole("button", "Try again", "click");
  await waitText("E2E grounded answer");
  await findRole("heading", "E2E grounded answer", "text");
  await assertSingletonAssistantCalls(2);
  await assertNoReportWrites();
});
