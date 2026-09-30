import assert from "node:assert/strict";
import test from "node:test";

import { draftSaveSchema, shortNameFromName } from "@customreport/shared";
import superjson from "superjson";

import { formatPeriodRangeWithYear } from "../../apps/web/src/shared/lib/format/format-date.js";
import { SEED_REPORTS } from "../../prisma/seeds/support/seed-periods.js";
import { loginAsLead, openLeadReport } from "./access.js";
import {
  command,
  fill,
  findRole,
  getAttr,
  getText,
  getUrl,
  isVisible,
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
  scopeCount,
  scopedRef,
  scopeSnapshot,
  setOffline,
  waitButton,
  waitScope,
  waitSnapshot,
} from "./helpers.js";

registerE2eHooks();

const DECK_NAME = "Status slide deck (use arrow keys to navigate slides)";
const ARCHIVE_NAME = "Show closed (archived) report periods";
const VIEW_MODE_SCOPE = { role: "group", name: "View mode" } as const;
const PREVIOUS_PERIOD_DATE_RANGE = formatPeriodRangeWithYear(
  SEED_REPORTS.published.periodStart,
  SEED_REPORTS.published.periodEnd,
);
// Boris's CRM rows come from seed-simple.overlay-boris.ts.
const FOREIGN_SUPPORT = {
  risk: "Требования к аналитическому модулю не финализированы до старта разработки",
  decision: "Утвердить структуру аналитического API до начала разработки",
  ids: [
    "a0000000-0000-4000-8000-000000007002",
    "a0000000-0000-4000-8000-000000009002",
    "a0000000-0000-4000-8000-000000007004",
  ],
} as const;
type Snapshot = Awaited<ReturnType<typeof snapshot>>;

function namedRefs(
  data: Snapshot,
  role: string,
  matches: (name: string) => boolean,
) {
  return Object.entries(data.refs).flatMap(([id, ref]) =>
    ref.role === role && ref.name !== undefined && matches(ref.name)
      ? [{ ref: `@${id}`, name: ref.name }]
      : [],
  );
}

async function roleRef(role: string, name: string): Promise<string> {
  const data = await snapshot();
  const refs = refsByRole(data, role, name);
  const available = namedRefs(data, role, () => true).map(
    (entry) => entry.name,
  );
  assert.equal(
    refs.length,
    1,
    `${role}: ${name} must be unique; observed ${available.length > 0 ? JSON.stringify(available) : data.snapshot}`,
  );
  const ref = refs.at(0);
  assert.ok(ref);
  return ref;
}

async function assertAttribute(
  role: string,
  name: string,
  attribute: string,
  value: string | null,
) {
  assert.equal(await getAttr(await roleRef(role, name), attribute), value);
}

async function trackedRequests() {
  const data = await command(["network", "requests"]);
  assert.ok(Array.isArray(data.requests), "Missing tracked browser requests");
  return data.requests.map((entry: unknown) => {
    assert.ok(typeof entry === "object" && entry !== null);
    assert.ok("url" in entry && typeof entry.url === "string");
    assert.ok("method" in entry && typeof entry.method === "string");
    return {
      url: entry.url,
      method: entry.method,
      status: "status" in entry ? entry.status : undefined,
      postData: "postData" in entry ? entry.postData : undefined,
    };
  });
}

async function assertNoReportWrites(): Promise<void> {
  const requests = await trackedRequests();
  assert.ok(
    requests.some(
      ({ url, method }) =>
        method === "GET" && /leadForm\.(?:byPeriod|statusOverview)/.test(url),
    ),
    "The network log must contain real report reads before proving no writes",
  );
  assert.deepEqual(
    requests.filter(
      ({ url, method }) =>
        url.includes("/trpc/") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method),
    ),
    [],
  );
}

async function openReadOnlyReport(
  mode: "overview" | "slides" = "overview",
): Promise<void> {
  await loginAsLead();
  await command(["network", "requests"]);
  await openLeadReport(mode);
  await waitText(LEAD_FORM_FIXTURE.currentText);
}

async function counter(): Promise<{ current: number; total: number }> {
  const text = await roleText("group", "Slide carousel controls");
  const match = /\b(\d+)\s*\/\s*(\d+)\b/.exec(text);
  assert.ok(match, `Missing carousel counter: ${text}`);
  const current = Number(match[1]);
  const total = Number(match[2]);
  assert.ok(current > 0 && current <= total && total <= 100);
  return { current, total };
}

async function rowName(text: string): Promise<string> {
  const rows = namedRefs(
    await snapshot(),
    "button",
    (name) =>
      name.startsWith("Expand full details for ") && name.endsWith(`: ${text}`),
  );
  assert.equal(rows.length, 1, `A unique slide disclosure must show ${text}`);
  const row = rows.at(0);
  assert.ok(row);
  return row.name;
}

async function assertNoEditors(): Promise<void> {
  assert.equal(
    scopeCount(
      await snapshot(),
      "dialog",
      /^(?:Add|Edit) (?:Item|Risk|Decision)/,
    ),
    0,
  );
}

async function assertScope(role: string, name: string): Promise<void> {
  assert.equal(scopeCount(await snapshot(), role, name), 1);
  assert.ok((await roleText(role, name)).trim().length > 0);
}

async function clickViewMode(name: "Report" | "Slides"): Promise<void> {
  await command(["click", await scopedRef(VIEW_MODE_SCOPE, "link", name)]);
}

async function openPeriodPicker(): Promise<void> {
  await findRole("combobox", "Select reporting period", "click");
  await waitScope({ role: "listbox", name: "Reporting period" });
  await assertAttribute(
    "combobox",
    "Select reporting period",
    "aria-expanded",
    "true",
  );
}

void test("dev login opens the current lead report", async () => {
  await loginAsLead();
  assert.equal(
    new URL(await getUrl()).pathname,
    `/lead/report/${LEAD_FORM_FIXTURE.reportId}`,
  );
  assert.equal(await roleText("heading", "My Report"), "My Report");
  await assertScope("region", "Status overview");
  await open("/lead/report");
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.reportId}`,
  ]);
  await waitText("My Report");
  await open(`/lead/report/${LEAD_FORM_FIXTURE.reportId}?mode=edit`);
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.reportId}`,
  ]);
  assert.equal(new URL(await getUrl()).searchParams.has("mode"), false);
  await waitScope({ role: "region", name: "Status overview" });
  await waitScope({ role: "group", name: "Header completion actions" });
  await waitButton("Save draft now");
  assert.equal(
    await getAttr(
      await scopedRef(VIEW_MODE_SCOPE, "link", "Report"),
      "aria-current",
    ),
    "page",
  );
  assert.ok(await isVisible(await roleRef("button", "Save draft now")));
});

void test("Report and Slides preserve the selected period and record visibility", async () => {
  await openReadOnlyReport();
  await findRole("button", "Everyone", "click");
  await assertAttribute("button", "Everyone", "aria-pressed", "true");
  const overview = await roleText("region", "Status overview");
  assert.equal(overview.includes(LEAD_FORM_FIXTURE.foreignText), false);
  await clickViewMode("Slides");
  await waitText(LEAD_FORM_FIXTURE.foreignText);
  await assertAttribute("link", "Slides", "aria-current", "page");
  assert.equal(
    new URL(await getUrl()).pathname,
    `/lead/report/${LEAD_FORM_FIXTURE.reportId}`,
  );
  await reload();
  await waitText(LEAD_FORM_FIXTURE.foreignText);
  await assertAttribute("button", "Everyone", "aria-pressed", "true");
  await findRole("button", "Mine only", "click");
  await assertAttribute("button", "Mine only", "aria-pressed", "true");
  assert.equal(
    (await snapshot()).snapshot.includes(LEAD_FORM_FIXTURE.foreignText),
    false,
  );
  await clickViewMode("Report");
  await waitText("Status overview");
  await assertAttribute("button", "Mine only", "aria-pressed", "true");
  await findRole("button", "Previous period", "click");
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.previousReportId}`,
  ]);
  await waitText("Submitted");
  const history = await snapshot();
  assert.equal(
    namedRefs(history, "button", (name) =>
      /^(?:Save draft now|Retry saving draft|Submit(?: report)?$|Add item to |Update progress for |Edit item: )/.test(
        name,
      ),
    ).length,
    0,
  );
  assert.equal(
    scopeCount(history, "DisclosureTriangle", /^More actions for /),
    0,
  );
  await clickViewMode("Slides");
  await waitText("Viewing past period. This form is read-only.");
  assert.equal(
    new URL(await getUrl()).pathname,
    `/lead/report/${LEAD_FORM_FIXTURE.previousReportId}`,
  );
  await assertNoReportWrites();
});

void test("period navigation and archive filters open read-only history", async () => {
  await openReadOnlyReport("slides");
  await assertAttribute("button", "Next period", "disabled", "");
  await findRole("button", "Previous period", "click");
  await waitText("Viewing past period. This form is read-only.");
  const historyUrl = new URL(await getUrl()).pathname;
  assert.equal(
    historyUrl,
    `/lead/report/${LEAD_FORM_FIXTURE.previousReportId}`,
  );
  await assertReadOnlySlide();
  await openPeriodPicker();
  await assertScope("listbox", "Reporting period");
  const hiddenArchive = namedRefs(await snapshot(), "option", (name) =>
    name.includes("Archived"),
  );
  assert.equal(hiddenArchive.length, 0);
  await command(["press", "Escape"]);
  await assertAttribute(
    "combobox",
    "Select reporting period",
    "aria-expanded",
    "false",
  );
  await findRole("switch", ARCHIVE_NAME, "click");
  await assertAttribute("switch", ARCHIVE_NAME, "aria-checked", "true");
  await openPeriodPicker();
  const archived = namedRefs(await snapshot(), "option", (name) =>
    name.includes("Archived"),
  );
  assert.equal(archived.length, 4);
  const oldest = archived.at(-1);
  assert.ok(oldest);
  await findRole("option", oldest.name, "click");
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.oldestArchiveReportId}?mode=slides`,
  ]);
  await waitText("Viewing past period. This form is read-only.");
  await assertAttribute("button", "Previous period", "disabled", "");
  await findRole("switch", ARCHIVE_NAME, "click");
  await assertAttribute("switch", ARCHIVE_NAME, "aria-checked", "false");
  await openPeriodPicker();
  assert.equal(
    namedRefs(await snapshot(), "option", (name) => name.includes("Archived"))
      .length,
    1,
  );
  await command(["press", "Home"]);
  await command(["press", "Enter"]);
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.reportId}?mode=slides`,
  ]);
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await assertAttribute("button", "Next period", "disabled", "");
  await openPeriodPicker();
  await command(["press", "ArrowDown"]);
  await command(["press", "Enter"]);
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.previousReportId}?mode=slides`,
  ]);
  await waitText("Viewing past period. This form is read-only.");
  await assertNoReportWrites();
});

async function swipeOpenPeriodListbox(direction: "left" | "right") {
  await assertAttribute(
    "combobox",
    "Select reporting period",
    "aria-expanded",
    "true",
  );
  const listbox = await roleRef("listbox", "Reporting period");
  const { x, y, width, height } = await command(["get", "box", listbox]);
  assert.ok(typeof x === "number" && Number.isFinite(x));
  assert.ok(typeof y === "number" && Number.isFinite(y));
  assert.ok(typeof width === "number" && Number.isFinite(width));
  assert.ok(typeof height === "number" && Number.isFinite(height));
  // The pinned native CLI swipes from (200, 400); portals preserve React bubbling.
  assert.ok(
    x < 100 && x + width > 300 && y < 400 && y + height > 400,
    "The open period listbox must contain the entire native swipe path",
  );
  await command(["swipe", direction, "100"]);
}

void test("period listbox touch swipes move between Current and read-only history", async () => {
  await openReadOnlyReport("slides");
  await command(["set", "viewport", "400", "800"]);
  await findRole("switch", ARCHIVE_NAME, "click");
  await assertAttribute("switch", ARCHIVE_NAME, "aria-checked", "true");
  await openPeriodPicker();
  const options = namedRefs(
    scopeSnapshot(await snapshot(), "listbox", "Reporting period"),
    "option",
    () => true,
  );
  const current = options.at(0);
  const previous = options.at(1);
  assert.ok(current);
  assert.ok(current.name.includes("(Current)"));
  assert.ok(previous);
  assert.equal(previous.name, PREVIOUS_PERIOD_DATE_RANGE);
  await assertAttribute("option", current.name, "aria-selected", "true");
  await swipeOpenPeriodListbox("right");
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.previousReportId}?mode=slides`,
  ]);
  await waitText("Viewing past period. This form is read-only.");
  const history = await snapshot();
  assert.ok(
    namedRefs(history, "button", (name) =>
      name.startsWith("Expand full details for "),
    ).length > 0,
  );
  assert.equal(
    namedRefs(history, "button", (name) =>
      /^(?:Save draft now|Retry saving draft|Submit(?: report)?$|Add item to |\+ Add |Edit |Delete )/.test(
        name,
      ),
    ).length,
    0,
  );
  await assertAttribute("button", "Mine only", "aria-pressed", "true");
  await assertNoReportWrites();
  await command(["press", "Escape"]);
  await assertAttribute(
    "combobox",
    "Select reporting period",
    "aria-expanded",
    "false",
  );
  await openPeriodPicker();
  const selectedPrevious = namedRefs(
    scopeSnapshot(await snapshot(), "listbox", "Reporting period"),
    "option",
    (name) => name.replace(/ Submitted$/, "") === PREVIOUS_PERIOD_DATE_RANGE,
  );
  assert.equal(selectedPrevious.length, 1);
  const previousOption = selectedPrevious.at(0);
  assert.ok(previousOption);
  assert.equal(await getAttr(previousOption.ref, "aria-selected"), "true");
  await swipeOpenPeriodListbox("left");
  await command([
    "wait",
    "--url",
    `**/lead/report/${LEAD_FORM_FIXTURE.reportId}?mode=slides`,
  ]);
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await assertAttribute("button", "Next period", "disabled", "");
  await command(["press", "Escape"]);
  await openPeriodPicker();
  await assertAttribute("option", current.name, "aria-selected", "true");
  await command(["press", "Escape"]);
  await reload();
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await assertAttribute("button", "Next period", "disabled", "");
  await assertNoReportWrites();
});

async function assertReadOnlySlide(): Promise<void> {
  const data = await snapshot();
  assert.equal(
    namedRefs(data, "button", (name) =>
      /^(?:Save draft now|Retry saving draft|Submit(?: report)?$|Add item to |\+ Add )/.test(
        name,
      ),
    ).length,
    0,
  );
  const rows = namedRefs(data, "button", (name) =>
    name.startsWith("Expand full details for "),
  );
  const row = rows.at(0);
  assert.ok(row, "History must contain a real readable record");
  await command(["dblclick", row.ref]);
  await assertNoEditors();
  const expanded = await snapshot();
  assert.equal(
    namedRefs(expanded, "button", (name) => name.startsWith("Edit ")).length,
    0,
  );
}

void test("Everyone preserves foreign record read-only boundaries", async () => {
  await openReadOnlyReport("slides");
  await findRole("button", "Everyone", "click");
  await waitText(LEAD_FORM_FIXTURE.foreignText);
  const name = await rowName(LEAD_FORM_FIXTURE.foreignText);
  await findRole("button", name, "click");
  const collapse = name.replace("Expand full", "Collapse full");
  await assertAttribute("button", collapse, "aria-expanded", "true");
  const expanded = await snapshot();
  assert.equal(
    namedRefs(
      expanded,
      "button",
      (candidate) =>
        candidate.startsWith("Edit ") &&
        candidate.includes(LEAD_FORM_FIXTURE.foreignText.slice(0, 40)),
    ).length,
    0,
  );
  for (const privateText of Object.values(LEAD_FORM_FIXTURE.privateStrings)) {
    assert.equal(expanded.snapshot.includes(privateText), false);
  }
  await command(["dblclick", await roleRef("button", collapse)]);
  await assertNoEditors();
  await reload();
  await waitText(LEAD_FORM_FIXTURE.foreignText);
  await assertAttribute("button", "Everyone", "aria-pressed", "true");
  await assertNoReportWrites();
});

async function openSupportingSections(): Promise<void> {
  for (const title of ["Risks & Blockers", "Decisions"]) {
    await findRole("button", `Expand ${title}`, "click");
    await waitButton(`Collapse ${title}`);
    await assertAttribute(
      "button",
      `Collapse ${title}`,
      "aria-expanded",
      "true",
    );
    const panelId = await getAttr(
      await roleRef("button", `Collapse ${title}`),
      "aria-controls",
    );
    assert.ok(panelId, `${title} must identify its controlled panel`);
    await command([
      "wait",
      "--fn",
      `document.getElementById(${JSON.stringify(panelId)})?.getAnimations().every(animation => animation.playState !== "running") === true`,
    ]);
  }
}

function supportEditingNames(data: Snapshot): string[] {
  return namedRefs(data, "button", (name) =>
    /^(?:Edit risk for |Delete risk for |Escalate risk for |Downgrade risk for |Edit decision$|Delete decision for )/.test(
      name,
    ),
  )
    .map(({ name }) => name)
    .sort();
}

async function assertForeignSupport(
  ownEditing: readonly string[],
): Promise<void> {
  await waitText(FOREIGN_SUPPORT.risk);
  await waitText(FOREIGN_SUPPORT.decision);
  const data = await snapshot();
  assert.ok(
    scopeSnapshot(data, "region", "Risks & Blockers").snapshot.includes(
      FOREIGN_SUPPORT.risk,
    ),
  );
  assert.ok(
    scopeSnapshot(data, "region", "Decisions").snapshot.includes(
      FOREIGN_SUPPORT.decision,
    ),
  );
  for (const owner of [
    shortNameFromName(LEAD_FORM_FIXTURE.foreignLeadName),
    LEAD_FORM_FIXTURE.foreignLeadName,
  ]) {
    assert.ok(
      scopeCount(data, "image", `Read-only — authored by ${owner}`) > 0,
    );
  }
  assert.deepEqual(supportEditingNames(data), ownEditing);
}

async function assertForeignSlides(): Promise<void> {
  const texts = [
    LEAD_FORM_FIXTURE.foreignText,
    FOREIGN_SUPPORT.risk,
    FOREIGN_SUPPORT.decision,
  ];
  for (const text of texts) {
    await waitText(text);
    assert.ok(await rowName(text));
  }
  const data = await snapshot();
  for (const text of texts) {
    assert.equal(
      namedRefs(
        data,
        "button",
        (name) => name.startsWith("Edit ") && name.includes(text.slice(0, 40)),
      ).length,
      0,
    );
  }
  for (const privateText of Object.values(LEAD_FORM_FIXTURE.privateStrings)) {
    assert.equal(data.snapshot.includes(privateText), false);
  }
  await assertNoEditors();
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(
    typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return value as Record<string, unknown>;
}

function observedSaveInput(
  request: Awaited<ReturnType<typeof trackedRequests>>[number],
) {
  assert.ok(typeof request.postData === "string");
  const procedurePath = decodeURIComponent(new URL(request.url).pathname);
  const procedures = procedurePath.split("/trpc/").at(1)?.split(",");
  assert.ok(procedures);
  const index = procedures.indexOf("reports.saveDraft");
  assert.ok(index !== -1);
  const batch = record(JSON.parse(request.postData) as unknown);
  const envelope = record(batch[String(index)]);
  return record(superjson.parse(JSON.stringify(envelope)));
}

async function assertOwnSavePayload(marker: string): Promise<void> {
  const requests = (await trackedRequests()).filter(
    ({ url, method, status }) =>
      method === "POST" && status === 200 && url.includes("reports.saveDraft"),
  );
  assert.ok(requests.length > 0, "A real draft-save POST must be acknowledged");
  for (const request of requests) {
    const input = observedSaveInput(request);
    const parsed = draftSaveSchema.safeParse(input);
    assert.ok(parsed.success, parsed.success ? "" : parsed.error.message);
    const payload = parsed.data;
    assert.equal(
      payload.reportSectionId,
      "a0000000-0000-4000-8000-000000000401",
    );
    assert.ok(
      payload.items.some(
        (item) =>
          item.text === marker &&
          item.type === "current" &&
          item.activityId !== null &&
          item.activityId !== undefined &&
          item.projectId === null,
      ),
    );
    assert.ok(payload.risks.length > 0 && payload.decisions.length > 0);
    assert.ok(
      payload.decisions.every(
        (decision) => decision.owner === LEAD_FORM_FIXTURE.leadName,
      ),
    );
    const sent = JSON.stringify(input);
    for (const foreign of [
      LEAD_FORM_FIXTURE.foreignText,
      FOREIGN_SUPPORT.risk,
      FOREIGN_SUPPORT.decision,
      ...FOREIGN_SUPPORT.ids,
      ...Object.values(LEAD_FORM_FIXTURE.privateStrings),
      "foreign:",
    ]) {
      assert.equal(
        sent.includes(foreign),
        false,
        `Foreign data sent: ${foreign}`,
      );
    }
  }
}

void test("Everyone saves only the Lead records and preserves foreign content", async () => {
  await openReadOnlyReport();
  await waitScope({ role: "group", name: "Header completion actions" });
  await waitButton(`Add item to ${LEAD_FORM_FIXTURE.activityName}`);
  await openSupportingSections();
  const ownEditing = supportEditingNames(await snapshot());
  assert.ok(ownEditing.length > 0);
  await findRole("button", "Everyone", "click");
  await assertAttribute("button", "Everyone", "aria-pressed", "true");
  await assertForeignSupport(ownEditing);
  await clickViewMode("Slides");
  await assertForeignSlides();
  await clickViewMode("Report");
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await waitScope({ role: "region", name: "Status overview" });
  await waitScope({ role: "group", name: "Header completion actions" });
  await waitButton(`Add item to ${LEAD_FORM_FIXTURE.activityName}`);
  const marker = "E2E Everyone own activity progress";
  await command(["network", "requests", "--clear"]);
  await findRole(
    "button",
    `Add item to ${LEAD_FORM_FIXTURE.activityName}`,
    "click",
  );
  await fill("Description *", marker);
  await findRole("button", "Save update", "click");
  await waitText(marker);
  await saveDraft();
  await assertOwnSavePayload(marker);
  await reload();
  await waitText(marker);
  await assertAttribute("button", "Everyone", "aria-pressed", "true");
  await openSupportingSections();
  await assertForeignSupport(ownEditing);
  await clickViewMode("Slides");
  await assertForeignSlides();
  assert.ok((await snapshot()).snapshot.includes(marker));
});

void test("Status overview initial read failure recovers through Try again", async () => {
  await openReadOnlyReport("slides");
  const route = "**/trpc/*leadForm.statusOverview*";
  await command(["network", "route", route, "--abort"]);
  try {
    await clickViewMode("Report");
    await waitText("Status overview unavailable");
    assert.equal(
      await roleText("heading", "Status overview unavailable"),
      "Status overview unavailable",
    );
  } finally {
    await command(["network", "unroute", route]);
  }
  await findRole("button", "Try again", "click");
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await assertScope("region", "Status overview");
  assert.ok(
    await isVisible(
      await roleRef("button", `Add item to ${LEAD_FORM_FIXTURE.activityName}`),
    ),
  );
  await assertNoReportWrites();
});

void test("required Slides read failure recovers through Retry", async () => {
  await loginAsLead();
  await command(["network", "requests"]);
  const route = "**/trpc/*leadForm.byPeriod*";
  await command(["network", "route", route, "--abort"]);
  try {
    await open(`/lead/report/${LEAD_FORM_FIXTURE.reportId}?mode=slides`);
    await waitText("Report form could not be loaded");
    assert.ok(await isVisible(await roleRef("button", "Retry")));
  } finally {
    await command(["network", "unroute", route]);
  }
  await findRole("button", "Retry", "click");
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await assertScope("group", DECK_NAME);
  await assertNoReportWrites();
});

async function addRecoveryRisk(text: string): Promise<void> {
  const dialog = { role: "dialog", name: /^Add Risk(?: — .+)?$/ };
  await findRole("button", "+ Add Risk", "click");
  await waitScope(dialog);
  await command([
    "select",
    await scopedRef(dialog, "combobox", "Parent"),
    LEAD_FORM_FIXTURE.activityName,
  ]);
  await waitScope({
    role: "dialog",
    name: `Add Risk — ${LEAD_FORM_FIXTURE.activityName}`,
  });
  await fill("Risk *", text);
  await fill("Impact *", "E2E editing recovery impact");
  await fill("Mitigation *", "E2E editing recovery mitigation");
  await findRole("button", "Save risk", "click");
}

async function assertOverviewEditingUnavailable(): Promise<void> {
  const data = await snapshot();
  assert.ok(
    scopeSnapshot(data, "region", "Status overview").snapshot.includes(
      LEAD_FORM_FIXTURE.currentText,
    ),
  );
  assert.equal(
    namedRefs(data, "button", (name) =>
      /^(?:Save draft now|Retry saving draft|Submit(?: report)?$|Add item to |Update progress for |\+ Add )/.test(
        name,
      ),
    ).length,
    0,
  );
  assert.equal(scopeCount(data, "DisclosureTriangle", /^More actions for /), 0);
  await assertNoEditors();
}

void test("Overview editing read failure preserves data and recovers through Retry editing", async () => {
  await openReadOnlyReport();
  const route = "**/trpc/*leadForm.byPeriod*";
  const risk = "E2E editing read recovery risk";
  // A saved draft invalidates editor reads while the Overview remains loaded.
  await command(["network", "route", route, "--abort"]);
  try {
    await addRecoveryRisk(risk);
    await waitText(
      "Editing is temporarily unavailable. Overview remains read-only.",
    );
    await waitText("Retry editing");
    await assertOverviewEditingUnavailable();
    assert.ok(
      (await trackedRequests()).some(
        ({ url, method, status }) =>
          method === "POST" &&
          status === 200 &&
          url.includes("reports.saveDraft"),
      ),
      "The saved risk must trigger the real editor-query invalidation",
    );
  } finally {
    await command(["network", "unroute", route]);
  }
  await command(["network", "requests", "--clear"]);
  try {
    await setOffline(true);
    await findRole("button", "Retry editing", "click");
    await waitText("Retrying editing…");
    await assertAttribute("button", "Retrying editing…", "disabled", "");
    assert.equal(
      refsByRole(await snapshot(), "button", "Retry editing").length,
      0,
    );
    await assertOverviewEditingUnavailable();
  } finally {
    await setOffline(false);
  }
  await waitText("+ Add Risk");
  await assertScope("region", "Status overview");
  assert.ok(
    await isVisible(
      await roleRef("button", `Add item to ${LEAD_FORM_FIXTURE.activityName}`),
    ),
  );
  assert.equal(
    scopeCount(await snapshot(), "button", /^Retry(?:ing)? editing/),
    0,
  );
  await reload();
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await clickViewMode("Slides");
  await waitText(risk);
  await assertNoReportWrites();
});

void test("open-work read failure recovers through Retry open work", async () => {
  await openReadOnlyReport("slides");
  const route = "**/trpc/*leadForm.openWork*";
  await command(["network", "route", route, "--abort"]);
  try {
    await clickViewMode("Report");
    await waitText("Retry open work");
    await assertScope("region", "Status overview");
    assert.ok(
      (await snapshot()).snapshot.includes(LEAD_FORM_FIXTURE.currentText),
    );
  } finally {
    await command(["network", "unroute", route]);
  }
  await findRole("button", "Retry open work", "click");
  await waitText(OPEN_WORK_FIXTURE.paused);
  await assertScope("region", "Open work from earlier periods");
  assert.equal(
    refsByRole(await snapshot(), "button", "Retry open work").length,
    0,
  );
  await assertNoReportWrites();
});

void test("empty report states explain why authoring is unavailable", async () => {
  await loginAsLead();
  await command(["network", "requests"]);
  await open(`/lead/report/${LEAD_FORM_FIXTURE.futureReportId}?mode=slides`);
  await waitText("Report form unavailable");
  assert.equal(
    await roleText("heading", "Report form unavailable"),
    "Report form unavailable",
  );
  assert.ok(
    (await snapshot()).snapshot.includes(
      "This reporting period does not have an editable section for your account.",
    ),
  );
  assert.equal(
    await getAttr(await roleRef("link", "View report history →"), "href"),
    "/reports",
  );
  assert.equal(
    namedRefs(await snapshot(), "button", (name) =>
      /^(?:Save draft now|Submit(?: report)?$|Add item to |\+ Add )/.test(name),
    ).length,
    0,
  );
  assert.equal(
    new URL(await getUrl()).pathname,
    `/lead/report/${LEAD_FORM_FIXTURE.futureReportId}`,
  );
  await assertNoReportWrites();
});

void test("Slides density, pagination and fullscreen controls work", async () => {
  await openReadOnlyReport("slides");
  assert.deepEqual(await counter(), { current: 1, total: 1 });
  await assertAttribute("button", "Document", "aria-pressed", "true");
  await assertAttribute("button", "Previous slide", "disabled", "");
  await assertAttribute("button", "Next slide", "disabled", "");
  await findRole("button", "Presentation", "click");
  await assertAttribute("button", "Presentation", "aria-pressed", "true");
  const start = await counter();
  assert.ok(start.total > 1);
  await findRole("button", "Next slide", "click");
  assert.deepEqual(await counter(), { current: 2, total: start.total });
  await focusDeckArrowControl();
  await command(["press", "ArrowLeft"]);
  assert.equal((await counter()).current, 1);
  await focusDeckArrowControl();
  await command(["press", "ArrowLeft"]);
  assert.equal((await counter()).current, 1);
  await command(["press", "ArrowRight"]);
  assert.equal((await counter()).current, 2);
  for (let page = 2; page < start.total; page += 1) {
    await findRole("button", "Next slide", "click");
    assert.equal((await counter()).current, page + 1);
  }
  await assertAttribute("button", "Next slide", "disabled", "");
  await focusDeckArrowControl();
  await command(["press", "ArrowRight"]);
  assert.equal((await counter()).current, start.total);
  await assertFullscreenPreservesPage(start.total);
  await findRole("button", "Document", "click");
  assert.deepEqual(await counter(), { current: 1, total: 1 });
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await assertNoReportWrites();
});

async function focusDeckArrowControl(): Promise<void> {
  const deck = scopeSnapshot(await snapshot(), "group", DECK_NAME);
  const controls = ["Previous slide", "Next slide"].flatMap((name) =>
    refsByRole(deck, "button", name),
  );
  const observed = await Promise.all(
    controls.map(async (ref) => ({
      ref,
      disabled: await getAttr(ref, "disabled"),
    })),
  );
  const enabled = observed.find(({ disabled }) => disabled === null);
  assert.ok(enabled, "Presentation must have an enabled carousel control");
  await command(["focus", enabled.ref]);
}

async function waitFullscreen(active: boolean): Promise<void> {
  await command([
    "wait",
    "--fn",
    `document.fullscreenElement ${active ? "!==" : "==="} null`,
  ]);
  await waitButton(active ? "Exit fullscreen" : "Enter fullscreen");
}

async function fullscreenExitRef(): Promise<string> {
  await waitText("Press Esc to exit fullscreen");
  const data = await waitSnapshot(async (observed) => {
    const exits = refsByRole(observed, "button", "Exit fullscreen");
    const floating = exits.at(0);
    if (
      exits.length !== 1 ||
      refsByRole(observed, "button", "Enter fullscreen").length > 0 ||
      floating === undefined
    )
      return false;
    return (
      (await getText(floating)).trim() === "Exit" && (await isVisible(floating))
    );
  }, "Expected one visible floating Exit fullscreen control");
  const exits = refsByRole(data, "button", "Exit fullscreen");
  assert.equal(
    exits.length,
    1,
    "The fullscreen surface must expose one floating Exit control",
  );
  assert.equal(refsByRole(data, "button", "Enter fullscreen").length, 0);
  const floating = exits.at(0);
  assert.ok(floating);
  assert.equal((await getText(floating)).trim(), "Exit");
  assert.ok(await isVisible(floating));
  assert.equal(await getAttr(floating, "aria-label"), "Exit fullscreen");
  assert.equal(await getAttr(floating, "aria-pressed"), "true");
  return floating;
}

async function assertFullscreenPreservesPage(page: number): Promise<void> {
  await findRole("button", "Enter fullscreen", "click");
  await waitFullscreen(true);
  await command(["click", await fullscreenExitRef()]);
  await waitFullscreen(false);
  await assertAttribute("button", "Enter fullscreen", "aria-pressed", "false");
  assert.equal((await counter()).current, page);
  await findRole("button", "Enter fullscreen", "click");
  await waitFullscreen(true);
  await command(["press", "Escape"]);
  await waitFullscreen(false);
  await assertAttribute("button", "Enter fullscreen", "aria-pressed", "false");
  assert.equal((await counter()).current, page);
  // Fullscreen input uses native key-only events without press synthesis.
  const toolbarToggle = await roleRef("button", "Enter fullscreen");
  await command(["focus", toolbarToggle]);
  await command(["keydown", "f"]);
  await command(["keyup", "f"]);
  await waitFullscreen(true);
  await fullscreenExitRef();
  assert.equal((await counter()).current, page);
  await command(["keydown", "f"]);
  await command(["keyup", "f"]);
  await waitFullscreen(false);
  await assertAttribute("button", "Enter fullscreen", "aria-pressed", "false");
  assert.equal((await counter()).current, page);
}

void test("Slides details disclose without writing and canonical edit stays explicit", async () => {
  await openReadOnlyReport("slides");
  await checkRowDisclosure(await rowName(LEAD_FORM_FIXTURE.currentText));
  await checkRowDisclosure(await rowName(LEAD_FORM_FIXTURE.nextText));
  const risk = namedRefs(await snapshot(), "button", (name) =>
    /^Expand full details for (?:At risk|Blocked):/.test(name),
  ).at(0);
  const decision = namedRefs(await snapshot(), "button", (name) =>
    name.startsWith("Expand full details for Decision:"),
  ).at(0);
  assert.ok(risk);
  assert.ok(decision);
  await checkRowDisclosure(risk.name, ["Impact:", "Mitigation:"]);
  await checkRowDisclosure(decision.name, ["Impact:"]);
  await findRole("button", "Presentation", "click");
  await goToSlideWith(LEAD_FORM_FIXTURE.currentText);
  const baseline = await counter();
  assert.ok(baseline.total > 1, "Typing guard needs a navigable deck");
  const ownName = await rowName(LEAD_FORM_FIXTURE.currentText);
  await command(["dblclick", await roleRef("button", ownName)]);
  await waitText(`Edit Item — ${LEAD_FORM_FIXTURE.productName}`);
  await assertScope("dialog", `Edit Item — ${LEAD_FORM_FIXTURE.productName}`);
  const description = await roleRef("textbox", "Description *");
  await command(["focus", description]);
  await command([
    "press",
    baseline.current < baseline.total ? "ArrowRight" : "ArrowLeft",
  ]);
  assert.deepEqual(await counter(), baseline);
  await command(["press", "f"]);
  const typed = await command([
    "get",
    "value",
    await roleRef("textbox", "Description *"),
  ]);
  assert.ok(typeof typed.value === "string" && typed.value.includes("f"));
  assert.equal(
    refsByRole(await snapshot(), "button", "Exit fullscreen").length,
    0,
  );
  await command([
    "fill",
    await roleRef("textbox", "Description *"),
    LEAD_FORM_FIXTURE.currentText,
  ]);
  await findRole("button", "Cancel", "click");
  await assertNoEditors();
  await checkExplicitEdit(ownName, "Enter");
  await checkExplicitEdit(ownName, "Space");
  await reload();
  await waitText(LEAD_FORM_FIXTURE.currentText);
  await assertNoReportWrites();
});

async function goToSlideWith(text: string): Promise<void> {
  const { total } = await counter();
  for (let page = 1; page <= total; page += 1) {
    if (
      namedRefs(
        await snapshot(),
        "button",
        (name) =>
          name.startsWith("Expand full details for ") &&
          name.endsWith(`: ${text}`),
      ).length > 0
    )
      return;
    assert.ok(page < total, `Presentation omitted ${text}`);
    await findRole("button", "Next slide", "click");
  }
}

async function checkExplicitEdit(
  name: string,
  key: "Enter" | "Space",
): Promise<void> {
  const collapse = name.replace("Expand full", "Collapse full");
  const data = await snapshot();
  if (refsByRole(data, "button", name).length === 1) {
    await findRole("button", name, "click");
  }
  await assertAttribute("button", collapse, "aria-expanded", "true");
  const edits = namedRefs(
    await snapshot(),
    "button",
    (candidate) =>
      candidate.startsWith("Edit In progress: ") &&
      candidate.includes(LEAD_FORM_FIXTURE.currentText.slice(0, 40)),
  );
  assert.equal(edits.length, 1);
  const edit = edits.at(0);
  assert.ok(edit);
  await command(["focus", edit.ref]);
  await command(["press", key]);
  await waitText(`Edit Item — ${LEAD_FORM_FIXTURE.productName}`);
  await assertScope("dialog", `Edit Item — ${LEAD_FORM_FIXTURE.productName}`);
  await findRole("button", "Cancel", "click");
  await assertNoEditors();
}

async function checkRowDisclosure(
  name: string,
  details: readonly string[] = [],
): Promise<void> {
  const collapse = name.replace("Expand full", "Collapse full");
  await findRole("button", name, "click");
  await assertAttribute("button", collapse, "aria-expanded", "true");
  const opened = await snapshot();
  for (const detail of details) assert.ok(opened.snapshot.includes(detail));
  await assertNoEditors();
  await command(["focus", await roleRef("button", collapse)]);
  await command(["press", "Escape"]);
  await assertAttribute("button", name, "aria-expanded", "false");
  await command(["focus", await roleRef("button", name)]);
  await command(["press", "Enter"]);
  await assertAttribute("button", collapse, "aria-expanded", "true");
  await command(["press", "Space"]);
  await assertAttribute("button", name, "aria-expanded", "false");
  await assertNoEditors();
}
