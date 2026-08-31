import assert from "node:assert/strict";
import test from "node:test";

import {
  checksApiRuntime,
  hasBareInternalPackageImport,
  isProductionDistMode,
} from "./production-dist-policy.js";

void test("production dist policy recognizes only current build modes", () => {
  assert.equal(isProductionDistMode("--all"), true);
  assert.equal(isProductionDistMode("--api"), true);
  assert.equal(isProductionDistMode("--shared"), true);
  assert.equal(isProductionDistMode("--persistence"), false);
});

void test("all and API modes inspect the embedded API runtime", () => {
  assert.equal(checksApiRuntime("--all"), true);
  assert.equal(checksApiRuntime("--api"), true);
  assert.equal(checksApiRuntime("--shared"), false);
});

void test("bare workspace imports cannot remain in the API runtime", () => {
  assert.equal(
    hasBareInternalPackageImport("import '@customreport/shared';"),
    true,
  );
  assert.equal(
    hasBareInternalPackageImport(
      "export * from '@customreport/report-persistence';",
    ),
    true,
  );
  assert.equal(
    hasBareInternalPackageImport(
      "import '../packages/report-persistence/src/index.js';",
    ),
    false,
  );
});
