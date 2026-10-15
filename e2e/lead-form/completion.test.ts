import assert from "node:assert/strict";
import test from "node:test";

import type { ReportAssistantOutcome } from "@weeklyreport/shared";

import { PROD_CRM_360 } from "../../prisma/seeds/simple/seed-simple.ids.js";
import { DEMO_STAGE_ASSIGNMENTS } from "../../prisma/seeds/simple/seed-simple.stages.js";
import { E2E_BASE_URL } from "../setup/base-url.js";
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
import { assertFocused, centerControl } from "./focus.js";
import {
  ARCHIVED_FILL_FIXTURE,
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

registerE2eHooks();

const AVAILABILITY_ROUTE = "**/trpc/*ai.availability*";
const SINGLE_AVAILABILITY_ROUTE = "**/trpc/ai.availability?*";
const OPEN_WORK_ROUTE = "**/trpc/*leadForm.openWork*";
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
// The earlier-open-work register rests as one collapsed disclosure line.
const EARLIER_OPEN_WORK = /^\d+ earlier open items?$/u;
const PENDING_REVIEW = "1 to review";
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

// The status icon is the item's one primary control; its name carries the
// current status, so focus is matched on the stable prefix.
async function assertStatusFocused(text: string): Promise<void> {
  const prefix = JSON.stringify(`Status of ${text}:`);
  await command([
    "wait",
    "--fn",
    `document.activeElement?.getAttribute('aria-label')?.startsWith(${prefix}) === true`,
  ]);
}

async function pendingReviewCounters(): Promise<string[]> {
  const data = await command([
    "eval",
    `Array.from(document.querySelectorAll('[data-testid="pending-review-count"]')).map(element => element.textContent ?? '')`,
  ]);
  assert(Array.isArray(data.result), "Missing pending review counters");
  return data.result.map(String);
}

async function openEarlierWork(): Promise<void> {
  // <summary> exposes no snapshot ref, so the summary is found by role and name.
  const data = await waitSnapshot(
    (observed) =>
      scopeCount(observed, "DisclosureTriangle", EARLIER_OPEN_WORK) === 1,
    "Expected the collapsed earlier open work disclosure",
  );
  const name = /DisclosureTriangle "(\d+ earlier open items?)"/u.exec(
    data.snapshot,
  )?.[1];
  assert(name, "Missing earlier open work summary name");
  await findRole("DisclosureTriangle", name, "click");
  await waitText("E2E paused work");
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
  // Both reads use httpBatchLink, so whether availability shares a batch with
  // the open-work read depends on render timing. Abort the open-work read too
  // so its failure is always driven, never inherited from a sibling batch.
  await command(["network", "route", OPEN_WORK_ROUTE, "--abort"]);
  await openLeadReport();
  await waitButton("Retry report chat availability check");
  await waitButton("Retry open work");
  await findRole("button", "Retry report chat availability check", "text");
  const unavailable = await refFor("button", "Report chat unavailable");
  assert.equal(await getAttr(unavailable, "aria-disabled"), "true");
  await refFor("button", "Retry open work");
  await command(["network", "unroute", AVAILABILITY_ROUTE]);
  await command(["network", "unroute", OPEN_WORK_ROUTE]);
  // Recover the open-work register through its own UI retry; no fake report
  // response is used by the chat stub.
  await findRole("button", "Retry open work", "click");
  await openEarlierWork();
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
  await command(["wait", "--url", `${E2E_BASE_URL}/`]);
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
  await waitButton(`Edit item: ${text}`);
  await findRole("button", `Edit item: ${text}`, "text");
  await saveDraft();
}

async function openFillConfirmation(): Promise<{ role: string; name: RegExp }> {
  // The completion handoff changes the split button's horizontal position.
  // Wait for the header actions to return before measuring the click target.
  await command(["eval", "scrollTo(0, 0)"]);
  await waitScope({ role: "group", name: "Header completion actions" });
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
  await findRole("button", "+ Add risk", "click");
  await waitScope({ role: "dialog", name: /^Add risk — /u });
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
  await clickScoped(confirmation, "button", "Replace & fill");
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
    /1 to review\. Complete the items below before submitting\./u,
  );
  const counters = await pendingReviewCounters();
  assert(counters.length > 0, "The Save/Submit cluster must show the counter");
  assert(counters.every((counter) => counter === PENDING_REVIEW));
  await findRole("heading", "Fix before submitting", "text");
  const reviewName = `Review "${LEAD_FORM_FIXTURE.carriedText}".`;
  const review = oneRef(await snapshot(), "link", reviewName);
  await centerControl(review);
  await command(["click", review]);
  await assertStatusFocused(LEAD_FORM_FIXTURE.carriedText);
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
  // The Risks & decisions jump link is gone: risks/decisions render inline
  // below the overview when the editor is ready, so assert them directly.
  const expandRisks = oneRef(
    await snapshot(),
    "button",
    "Expand Risks & Blockers",
  );
  await centerControl(expandRisks);
  await command(["click", expandRisks]);
  const expandDecisions = oneRef(
    await snapshot(),
    "button",
    "Expand Decisions",
  );
  await centerControl(expandDecisions);
  await command(["click", expandDecisions]);
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

void test("confirming suggested continuations clears the review counter and its blocker", async () => {
  await openLeadReport();
  await clearRequests();
  const review = `Review "${LEAD_FORM_FIXTURE.carriedText}".`;
  const missingCurrent =
    "Project CRM-Customer 360 needs at least one Current Week item.";
  await findRole("link", review, "text");
  await findRole("link", missingCurrent, "text");
  await findRole("button", "Confirm all as continue", "click");
  await command([
    "wait",
    "--fn",
    `document.querySelectorAll('[data-testid="pending-review-count"]').length === 0`,
  ]);
  assert.deepEqual(await pendingReviewCounters(), []);
  const data = await snapshot();
  assert.equal(refsByRole(data, "link", review).length, 0);
  assert.equal(refsByRole(data, "button", "Confirm all as continue").length, 0);
  // The other blocker and the end-of-form explanation stay in flow.
  await findRole("link", missingCurrent, "text");
  const readiness = await roleText("region", "Before you submit");
  assert.doesNotMatch(readiness, /to review/u);
  assert.match(readiness, /Complete the items below before submitting\./u);
  const submit = await scopedRef(
    { role: "region", name: "Before you submit" },
    "button",
    "Submit report",
  );
  assert.equal((await command(["is", "enabled", submit])).enabled, false);
});

void test("Fill from previous handles cancel and persists canonical replacement", async () => {
  await openLeadReport();
  await addMarker("E2E fill replacement marker");
  await clearRequests();
  const confirmation = await openFillConfirmation();
  await clickScoped(confirmation, "button", "Cancel");
  await waitClosed(confirmation);
  await assertFocused("Fill from most recent submitted period");
  await findRole("button", "Edit item: E2E fill replacement marker", "text");
  await assertNoReportWrites();
  const replacement = await openFillConfirmation();
  await clickScoped(replacement, "button", "Replace & fill");
  await waitText("Form filled from selected period");
  await reload();
  await expandFilledProduct();
  await waitButton(`Edit item: ${LEAD_FORM_FIXTURE.previousText}`);
  const data = await snapshot();
  assert.doesNotMatch(data.snapshot, /E2E fill replacement marker/u);
  assert.doesNotMatch(data.snapshot, /E2E own reviewer record feedback/u);
  await findRole(
    "button",
    `Edit item: ${LEAD_FORM_FIXTURE.previousText}`,
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
  await waitScope({ role: "dialog", name: /^Edit item — /u });
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

void test("Fill from pending replacement blocks dismissal and duplicate writes", async (context) => {
  await openLeadReport();
  await saveDraft();
  await clearRequests();
  const confirmation = await openFillConfirmation();
  async function observeFocus(phase: string): Promise<void> {
    const data = await command([
      "eval",
      `(() => {
        const active = document.activeElement;
        const dialog = document.querySelector('[role="alertdialog"]');
        return {
          insideDialog: dialog !== null && dialog.contains(active),
          visible: active instanceof HTMLElement && active.checkVisibility(),
          tag: active?.tagName,
          name: active?.getAttribute('aria-label') ?? active?.textContent?.trim().slice(0, 160),
          disabled: active?.matches(':disabled'),
        };
      })()`,
    ]);
    context.diagnostic(`${phase}: ${JSON.stringify(data.result)}`);
    if (["Tab", "Shift+Tab", "Escape"].includes(phase)) {
      const focus = record(data.result);
      assert.equal(focus.insideDialog, true, `${phase}: focus left the modal`);
      assert.equal(focus.visible, true, `${phase}: focused element hidden`);
    }
  }
  await assertFocused("Cancel");
  await observeFocus("before replacement");
  try {
    await setOffline(true);
    await clickScoped(confirmation, "button", "Replace & fill");
    await waitButton("Replace & fill", { busy: true });
    for (const name of ["Cancel", "Replace & fill"]) {
      const ref = await scopedRef(confirmation, "button", name);
      assert.notEqual(await getAttr(ref, "disabled"), null);
    }
    const confirm = await scopedRef(confirmation, "button", "Replace & fill");
    assert.equal(await getAttr(confirm, "aria-busy"), "true");
    await observeFocus("pending before keyboard");
    for (const key of ["Tab", "Shift+Tab", "Escape"]) {
      await command(["press", key]);
      await observeFocus(key);
    }
    assert.equal(
      scopeCount(await snapshot(), "alertdialog", confirmation.name),
      1,
    );
    await command(["press", "Enter"]);
    await assertNoReportWrites();
  } finally {
    await setOffline(false);
  }
  await waitNotification("Form filled from selected period");
  await waitClosed(confirmation);
  // Focus must return to the trigger; a failure here is a product finding, not flake.
  await assertFocused("Fill from most recent submitted period");
  await observeFocus("settled");
  const calls = (await requests()).filter(
    (request) =>
      request.method === "POST" &&
      typeof request.url === "string" &&
      request.url.includes("leadForm.fillFrom"),
  );
  assert.equal(calls.length, 1);
  await reload();
  await expandFilledProduct();
  await waitButton(`Edit item: ${LEAD_FORM_FIXTURE.previousText}`);
  await findRole(
    "button",
    `Edit item: ${LEAD_FORM_FIXTURE.previousText}`,
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
    "Overwrite & fill",
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
    "Overwrite & fill",
  );
  await waitText("Form filled from selected period");
  await command(["network", "unroute", DRAFT_ROUTE]);
  await reload();
  await expandFilledProduct();
  await waitButton(`Edit item: ${LEAD_FORM_FIXTURE.previousText}`);
  assert.doesNotMatch((await snapshot()).snapshot, /E2E unsaved fill risk/u);
  await findRole(
    "button",
    `Edit item: ${LEAD_FORM_FIXTURE.previousText}`,
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
    `Edit item: ${LEAD_FORM_FIXTURE.carriedText}`,
    "text",
  );
  await assertNoReportWrites();
});

void test("published lineage disables Fill from without a write", async () => {
  await openLeadReport();
  const verdict = `Continue — ${LEAD_FORM_FIXTURE.previousText}`;
  await clickScoped(
    { role: "article", name: `Product ${LEAD_FORM_FIXTURE.productName}` },
    "button",
    verdict,
  );
  await waitSnapshot(
    (data) => scopeCount(data, "button", verdict) === 0,
    "Expected the verdict rail to close after Continue",
  );
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
  const current = "Edit item: Minimal editable report item";
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
