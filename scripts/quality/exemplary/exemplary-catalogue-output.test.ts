import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { catalogueOutputPath } from "./exemplary-catalogue.ts";

// A caller-provided output dir is only ever an override, so a throwaway temp
// path keeps the probe hermetic (no real archive writes).
const overrideDir = mkdtempSync(join(tmpdir(), "catalogue-output-"));

void test("check mode never writes a catalogue output path", () => {
  assert.equal(catalogueOutputPath(true, {}), null);
  assert.equal(
    catalogueOutputPath(true, { CATALOGUE_OUTPUT_DIR: overrideDir }),
    null,
  );
});

void test("non-check mode defaults to the external archive", () => {
  const path = catalogueOutputPath(false, {});
  assert.ok(path);
  assert.match(path, /customreport-archive[\\/]exemplary-catalogue$/);
});

void test("non-check mode honours the explicit override", () => {
  assert.equal(
    catalogueOutputPath(false, { CATALOGUE_OUTPUT_DIR: overrideDir }),
    overrideDir,
  );
});
