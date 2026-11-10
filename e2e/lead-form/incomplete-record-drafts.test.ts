// A Lead may save a risk or decision with its name alone: it survives a reload
// as the author's private unfinished draft and blocks submit by name until its
// details are written. Publication leaves it out and says how many records it
// leaves out (openspec: lead-incomplete-record-drafts).
import assert from "node:assert/strict";
import test from "node:test";

import { loginAsHead, openLeadReport } from "./access.js";
import {
  command,
  fill,
  findRole,
  getAttr,
  headSession,
  open,
  refsByRole,
  reload,
  snapshot,
  waitText,
} from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import {
  LEAD_FORM_FIXTURE,
  oneRef,
  roleText,
  saveDraft,
  scopedRef,
  waitClosed,
  waitScope,
  waitSnapshot,
} from "./helpers.js";

registerE2eHooks();

const NAME = "E2E unfinished risk";
const RISK_DIALOG = { role: "dialog", name: /^Add risk — / } as const;
const PUBLISH_DIALOG = {
  role: "alertdialog",
  name: "Publish & lock report?",
} as const;

async function saveUnfinishedRisk(): Promise<void> {
  await openLeadReport();
  await findRole("button", "+ Add risk", "click");
  await waitScope(RISK_DIALOG);
  await command([
    "select",
    oneRef(await snapshot(), "combobox", "Parent"),
    LEAD_FORM_FIXTURE.activityName,
  ]);
  await fill("Risk *", NAME);
  // Impact and mitigation stay empty: only the name is needed to save.
  await findRole("button", "Save risk", "click");
  await waitClosed(RISK_DIALOG);
  await saveDraft();
}

void test("a risk saved with its name only survives reload and blocks submit by name", async () => {
  await saveUnfinishedRisk();

  await reload();
  await waitText(NAME);
  await waitText(`Finish the risk "${NAME}"`);
  const data = await snapshot();
  assert.ok(
    data.snapshot.includes("unfinished"),
    "The saved risk is marked as unfinished",
  );
  const submit = oneRef(data, "button", "Submit");
  assert.notEqual(
    await getAttr(submit, "disabled"),
    null,
    "Submit stays disabled while a saved record is unfinished",
  );
});

void test("Head publication names the unfinished risk it leaves out and never shows its text", async () => {
  await saveUnfinishedRisk();

  const session = headSession();
  await loginAsHead(session);
  const reportPath = `/head/report/${LEAD_FORM_FIXTURE.reportId}`;
  await open(reportPath, session);
  await waitText("Publish & lock", session);
  // The Head never reads another author's unfinished text.
  assert.ok(!(await snapshot(session)).snapshot.includes(NAME));

  await findRole("button", "Publish & lock", "click", { session });
  await waitScope(PUBLISH_DIALOG, session);
  const confirmation = await roleText(
    PUBLISH_DIALOG.role,
    PUBLISH_DIALOG.name,
    session,
  );
  assert.match(
    confirmation,
    /1 unfinished risk will be left out of the published report\./u,
  );
  assert.ok(!confirmation.includes(NAME));
  await command(
    [
      "click",
      await scopedRef(PUBLISH_DIALOG, "button", "Publish anyway", session),
    ],
    session,
  );
  await waitText("Period published & locked", session);

  // Searching the published history finds no unfinished text, and says what
  // the searched reports leave out.
  await open("/reports", session);
  await command(["wait", 'input[name="search"]'], session);
  await command(["fill", 'input[name="search"]', "unfinished"], session);
  await waitText("Search leaves out 1 unfinished risk", session);
  assert.ok(!(await snapshot(session)).snapshot.includes(NAME));

  // The frozen report holds no trace of the unfinished text.
  await open(reportPath, session);
  await waitText("Reopen period", session);
  const published = await snapshot(session);
  assert.ok(!published.snapshot.includes(NAME));
  assert.equal(refsByRole(published, "button", "Publish & lock").length, 0);
});

void test("after publication the Lead reads the kept unfinished risk in History", async () => {
  await saveUnfinishedRisk();
  const session = headSession();
  await loginAsHead(session);
  await open(`/head/report/${LEAD_FORM_FIXTURE.reportId}`, session);
  await waitText("Publish & lock", session);
  await findRole("button", "Publish & lock", "click", { session });
  await waitScope(PUBLISH_DIALOG, session);
  await command(
    [
      "click",
      await scopedRef(PUBLISH_DIALOG, "button", "Publish anyway", session),
    ],
    session,
  );
  await waitText("Period published & locked", session);

  // The author alone is told the draft was kept and can read it back.
  await open("/reports");
  const view = /^View 1 unfinished draft kept in /u;
  await waitSnapshot(
    (data) => refsByRole(data, "button", view).length === 1,
    "Expected the History card to name the kept unfinished draft",
  );
  await command(["click", oneRef(await snapshot(), "button", view)]);
  const dialog = { role: "dialog", name: "Unfinished drafts" } as const;
  await waitScope(dialog);
  assert.ok((await roleText(dialog.role, dialog.name)).includes(NAME));
  assert.equal(
    refsByRole(await snapshot(), "button", `Copy risk text: ${NAME}`).length,
    1,
  );
});
