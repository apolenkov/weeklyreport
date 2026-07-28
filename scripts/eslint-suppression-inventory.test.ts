import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { readSuppressionInventory } from "./eslint-suppression-inventory.ts";

const fixtureDir = mkdtempSync(path.join(tmpdir(), "suppression-inventory-"));
after(() => rmSync(fixtureDir, { force: true, recursive: true }));

const fixture = (name: string, source: string): string => {
  const file = path.join(fixtureDir, name);
  writeFileSync(file, source);
  return file;
};

void test("counts directive comments but not strings or explanatory mentions", () => {
  const file = fixture(
    "sample.ts",
    [
      'const text = "eslint-disable-next-line no-alert";',
      "// Inline eslint-disable is forbidden here",
      "// eslint-disable-next-line no-alert -- browser fixture",
      "alert(text);",
    ].join("\n"),
  );

  const inventory = readSuppressionInventory([file]);

  assert.equal(inventory.rawMatches, 3);
  assert.equal(inventory.directives.length, 1);
  assert.equal(inventory.noise.length, 2);
  const [directive] = inventory.directives;
  assert.ok(directive);
  assert.equal(directive.rule, "no-alert");
  assert.equal(directive.scope, "next-line");
  assert.equal(directive.target, "alert(text);");
});

void test("splits a multi-rule directive into independently owned records", () => {
  const file = fixture(
    "multi.ts",
    [
      "/* eslint-disable no-alert, no-console -- generated boundary */",
      "alert('x');",
    ].join("\n"),
  );

  const inventory = readSuppressionInventory([file]);

  assert.deepEqual(
    inventory.directives.map((entry) => entry.rule),
    ["no-alert", "no-console"],
  );
  assert.ok(inventory.directives.every((entry) => entry.scope === "file"));
});
