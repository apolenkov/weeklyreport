import assert from "node:assert/strict";
import test from "node:test";

import { parseScopeLedger } from "./eslint-policy-scope-ledger-schema.ts";

const entry = {
  configIndex: 1,
  id: "typed-scripts",
  classification: "policy",
  files: ["scripts/**/*.ts"],
  ignores: [],
  positive: "scripts/a.ts",
  negative: "apps/web/a.ts",
  marker: {
    kind: "rule",
    name: "no-alert",
    positive: "error",
    negative: "off",
  },
  evidence: "The scripts tree uses a dedicated typed policy.",
};

const ledger = (entries: readonly unknown[]): string =>
  JSON.stringify({
    version: 1,
    startingSnapshot: { commit: "deadbeef", overrideBlocks: entries.length },
    entries,
  });

void test("rejects duplicate config indexes", () => {
  assert.throws(
    () => parseScopeLedger(ledger([entry, { ...entry, id: "other" }])),
    /Duplicate ESLint scope ledger config index/,
  );
});

void test("rejects malformed classifications and unknown keys", () => {
  assert.throws(
    () =>
      parseScopeLedger(
        ledger([{ ...entry, classification: "guess", unexpected: true }]),
      ),
    /Invalid ESLint scope ledger/,
  );
});
