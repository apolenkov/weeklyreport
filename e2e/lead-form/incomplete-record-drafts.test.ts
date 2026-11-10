// A Lead may save a risk or decision with its name alone: it survives a reload
// as the author's private unfinished draft and blocks submit by name until its
// details are written (openspec: lead-incomplete-record-drafts).
import assert from "node:assert/strict";
import test from "node:test";

import { openLeadReport } from "./access.js";
import {
  command,
  fill,
  findRole,
  getAttr,
  reload,
  snapshot,
  waitText,
} from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import {
  LEAD_FORM_FIXTURE,
  oneRef,
  saveDraft,
  waitClosed,
  waitScope,
} from "./helpers.js";

registerE2eHooks();

const NAME = "E2E unfinished risk";
const RISK_DIALOG = { role: "dialog", name: /^Add risk — / } as const;

void test("a risk saved with its name only survives reload and blocks submit by name", async () => {
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
