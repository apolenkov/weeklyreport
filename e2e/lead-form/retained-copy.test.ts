import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareRetainedCopySource,
  readRetainedCopyState,
  RETAINED_COPY_FIXTURE,
} from "../setup/retained-copy.js";
import { openLeadReport } from "./access.js";
import {
  command,
  findRole,
  getUrl,
  refsByRole,
  reload,
  snapshot,
  waitText,
} from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import {
  LEAD_FORM_FIXTURE,
  oneRef,
  waitClosed,
  waitScope,
  waitSnapshot,
} from "./helpers.js";

registerE2eHooks();
const SAVE_ROUTE = "**/trpc/*reports.saveDraft*";

async function clickMatching(role: string, name: RegExp): Promise<void> {
  const observed = await waitSnapshot(
    (data) => refsByRole(data, role, name).length === 1,
    `Expected one ${role} matching ${name.source}`,
  );
  const ref = refsByRole(observed, role, name)[0];
  assert(ref);
  await command(["click", ref]);
}

async function openRetainedCopy(
  kind: "risk" | "decision",
  text: string,
): Promise<void> {
  await findRole("link", "Reports", "click");
  await clickMatching("checkbox", /^Show archived reports/);
  await clickMatching("button", /^View 2 unfinished drafts kept in/);
  await waitScope({ role: "dialog", name: "Unfinished drafts" });
  await findRole("link", `Copy ${kind} to current report: ${text}`, "click");
  await waitScope({ role: "heading", name: `Copy retained ${kind}` });
  assert.equal(
    new URL(await getUrl()).pathname,
    `/lead/report/${LEAD_FORM_FIXTURE.reportId}`,
  );
  const context = oneRef(await snapshot(), "combobox", "Add to");
  await command([
    "select",
    context,
    `activity:${RETAINED_COPY_FIXTURE.activityId}`,
  ]);
  await findRole("button", `Review copied ${kind}`, "click");
  await waitScope({
    role: "form",
    name: `Add ${kind} to ${LEAD_FORM_FIXTURE.activityName}`,
  });
  await command([
    "wait",
    "--fn",
    "!new URL(location.href).searchParams.has('copyStableId')",
  ]);
}

for (const kind of ["risk", "decision"] as const) {
  void test(`retained ${kind} copies through current context without changing source or duplicating an uncertain retry`, async () => {
    await prepareRetainedCopySource();
    const before = await readRetainedCopyState();
    await command(["set", "viewport", kind === "risk" ? "1280" : "375", "900"]);
    await openLeadReport();
    const text =
      kind === "risk"
        ? RETAINED_COPY_FIXTURE.riskText
        : RETAINED_COPY_FIXTURE.decisionText;
    await openRetainedCopy(kind, text);
    assert.deepEqual(
      await readRetainedCopyState(),
      before,
      "History, context selection and prefill must not write",
    );
    await command(["network", "route", SAVE_ROUTE, "--abort"]);
    await findRole("button", `Save ${kind}`, "click");
    await waitText("The save is not confirmed.");
    assert.deepEqual(
      await readRetainedCopyState(),
      before,
      "Aborted request must not be reported saved",
    );
    await command(["network", "unroute", SAVE_ROUTE]);
    await findRole("button", `Save ${kind}`, "click");
    await waitClosed({
      role: "form",
      name: `Add ${kind} to ${LEAD_FORM_FIXTURE.activityName}`,
    });
    await waitText("Saved draft — needs details");
    await reload();
    await waitText(text);
    await waitText("Saved, unfinished");
    const after = await readRetainedCopyState();
    assert.deepEqual(
      after.source,
      before.source,
      "Source rows, comments and frozen publication must stay unchanged",
    );
    const records =
      kind === "risk"
        ? after.target.risks.filter((row) => row.risk === text)
        : after.target.decisions.filter((row) => row.text === text);
    assert.equal(
      records.length,
      1,
      "Retry must create exactly one new lineage",
    );
    const copied = records[0];
    assert(copied);
    assert.equal(copied.activityId, RETAINED_COPY_FIXTURE.activityId);
    assert.equal(copied.impact, null);
    assert.deepEqual(copied.recordComments, []);
    assert.notEqual(
      copied.stableId,
      kind === "risk"
        ? RETAINED_COPY_FIXTURE.riskStableId
        : RETAINED_COPY_FIXTURE.decisionStableId,
    );
    if ("resolvedAt" in copied) {
      assert.equal(copied.resolvedAt, null);
      assert.equal(copied.owner, LEAD_FORM_FIXTURE.leadName);
    } else {
      assert.equal(copied.severity, "blocked");
      assert.equal(copied.mitigation, "Retained mitigation");
    }
  });
}
