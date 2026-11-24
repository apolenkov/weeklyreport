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
import { LEAD_FORM_FIXTURE, oneRef, waitClosed, waitScope } from "./helpers.js";

registerE2eHooks();

for (const kind of ["risk", "decision"] as const) {
  for (const context of [
    { parent: LEAD_FORM_FIXTURE.singleStageProductName, width: 1280 },
    { parent: LEAD_FORM_FIXTURE.activityName, width: 375 },
  ]) {
    void test(`inline ${kind} for ${context.parent} saves a private unfinished draft at ${context.width}px`, async () => {
      await command(["set", "viewport", String(context.width), "900"]);
      await openLeadReport();
      const name = `Add ${kind} to ${context.parent}`;
      await findRole("button", name, "click");
      const form = { role: "form", name };
      await waitScope(form);
      await command([
        "eval",
        `(() => {
        if (document.activeElement?.getAttribute('name') !== 'text') throw new Error('Primary field must receive focus');
        const form = document.querySelector('form[aria-label=${JSON.stringify(name)}]');
        if (!form || form.closest('[data-overview-create-lane]')) throw new Error('Record form must belong to the unit, without an item week lane');
        if (document.documentElement.scrollWidth > window.innerWidth) throw new Error('Document overflow');
        return true;
      })()`,
      ]);
      const text = `E2E inline unfinished ${kind} ${context.width}`;
      await fill(kind === "risk" ? "Risk" : "Decision", text);
      await findRole("button", `Save ${kind}`, "click");
      await waitClosed(form);
      await waitText("Saved draft — needs details");
      await command([
        "eval",
        `(() => {
        if (document.activeElement?.getAttribute('aria-label') !== ${JSON.stringify(name)}) throw new Error('Focus must return to the unit start');
        return true;
      })()`,
      ]);
      await reload();
      await waitText(text);
      await waitText("Saved, unfinished");
      const submit = oneRef(await snapshot(), "button", "Submit");
      assert.notEqual(
        await getAttr(submit, "disabled"),
        null,
        "Unfinished details must block section submission",
      );
    });
  }
}
