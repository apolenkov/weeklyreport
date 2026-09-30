import assert from "node:assert/strict";
import test from "node:test";

import {
  type BrowserSnapshot,
  scopeCount,
  scopeSnapshot,
} from "../lead-form/snapshot-scope.js";

const example: BrowserSnapshot = {
  snapshot: [
    '- region "Status overview":',
    '  - article "Primary product":',
    '    - group "Current week items":',
    '      - heading "Current week" [level=2, ref=e1]',
    '      - button "Update progress" [disabled=false, ref=e2]',
    '      - StaticText "Literal [ref=e3] text"',
    '  - article "Other product":',
    '    - button "Update progress" [ref=e3]',
    String.raw`- dialog "Edit \"quoted\" work":`,
    '  - textbox "Summary" [ref=e4]',
    '  - group "":',
    '    - button "Save" [ref=e5]',
  ].join("\n"),
  refs: {
    e1: { role: "heading", name: "Current week" },
    e2: { role: "button", name: "Update progress" },
    e3: { role: "button", name: "Update progress" },
    e4: { role: "textbox", name: "Summary" },
    e5: { role: "button", name: "Save" },
  },
};

void test("structural scopes retain combined-attribute descendant refs and exclude siblings", () => {
  const product = scopeSnapshot(example, "article", "Primary product");
  const current = scopeSnapshot(product, "group", "Current week items");
  assert.deepEqual(Object.keys(current.refs), ["e1", "e2"]);
  assert(!current.snapshot.includes("Other product"));
  assert.equal(scopeCount(example, "article", /product/u), 2);
});

void test("scope names support quoted accessible names and unnamed structural groups", () => {
  const dialog = scopeSnapshot(example, "dialog", 'Edit "quoted" work');
  assert.deepEqual(Object.keys(dialog.refs), ["e4", "e5"]);
  assert.equal(scopeCount(dialog, "group", ""), 1);
  assert.equal(scopeCount(dialog, "alertdialog"), 0);
});

void test("missing and ambiguous scopes fail instead of inventing structural refs", () => {
  assert.throws(
    () => scopeSnapshot(example, "form", "Update progress"),
    /got 0/u,
  );
  assert.throws(() => scopeSnapshot(example, "article"), /got 2/u);
});
