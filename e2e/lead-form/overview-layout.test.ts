import assert from "node:assert/strict";
import { test } from "node:test";

import { openLeadReport } from "./access.js";
import { command, findRole } from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";
import { LEAD_FORM_FIXTURE, waitScope } from "./helpers.js";

registerE2eHooks();

const recordName = `Edit text: ${LEAD_FORM_FIXTURE.currentText}, This week`;
const recordSelector = `.overview-record-trigger[aria-label=${JSON.stringify(recordName)}]`;
async function bounds(selector: string) {
  const measurement = await command([
    "eval",
    `(() => {
    const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return [rect.x,rect.y,rect.width,rect.height];
  })()`,
  ]);
  assert.ok(
    Array.isArray(measurement.result) &&
      measurement.result.every((value) => typeof value === "number"),
  );
  return measurement.result;
}

for (const width of [1280, 1728, 375]) {
  void test(`Overview tracks, record anchor and touch targets at ${width}px`, async () => {
    await openLeadReport();
    await command(["set", "viewport", String(width), "900"]);
    await command([
      "wait",
      "--fn",
      `document.querySelector('.overview-table') && (document.querySelector('.overview-table').clientWidth < 1087) === Boolean(document.querySelector('[data-overview-week-tab]'))`,
    ]);
    const layout = await command([
      "eval",
      `(() => {
      const table = document.querySelector('.overview-table');
      if (document.documentElement.scrollWidth > innerWidth) return 'overflow';
      if (table.clientWidth < 1087) return table.querySelector('[role=tab][aria-selected=true]')?.dataset.overviewWeekTab === 'current' ? 'tabs' : 'wrong tab';
      const headers = [...table.querySelector('.overview-column-headings').children].map(cell=>cell.getBoundingClientRect());
      const rows = [...table.querySelectorAll('[data-testid=overview-lineage-row]')].filter(row=>row.getClientRects().length);
      return headers.length === 3 && rows.length > 0 && rows.every(row=>[...row.querySelectorAll('[data-overview-lineage-lane]')].every((cell,index)=>{
        const rect = cell.getBoundingClientRect();
        return Math.abs(rect.left-headers[index].left)<=2 && Math.abs(rect.width-headers[index].width)<=2;
      })) ? 'columns' : 'misaligned';
    })()`,
    ]);
    assert.ok(
      layout.result === "tabs" || layout.result === "columns",
      String(layout.result),
    );
    if (width === 375) assert.equal(layout.result, "tabs");
    const selector = `[data-overview-lineage-lane="current"] ${recordSelector}`;
    await command(["scrollintoview", selector]);
    const before = await bounds(selector);
    if (width > 760) {
      await command(["hover", selector]);
      assert.deepEqual(await bounds(selector), before);
    }
    await command(["click", selector]);
    await waitScope({ role: "dialog", name: "Record" });
    if (width > 760) {
      const after = await bounds(selector);
      assert.deepEqual(after, before);
      const panel = await bounds('[role="dialog"][aria-label="Record"]');
      assert.ok(Math.abs((panel[2] ?? 0) - 392) <= 2);
    } else {
      const targets = await command([
        "eval",
        `[...document.querySelectorAll('[data-slot=sheet-content] button')].every(button=>{const rect=button.getBoundingClientRect();return rect.height>=44 && rect.width>=44;}) && !!document.querySelector('[data-slot=sheet-content]')`,
      ]);
      assert.equal(targets.result, true);
    }
    await findRole("button", "Cancel", "click");
  });
}
