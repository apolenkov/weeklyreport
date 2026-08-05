import assert from "node:assert/strict";
import test from "node:test";

import { parseSuppressionLedger } from "./eslint-suppression-ledger-schema.ts";

const entry = {
  path: "source.ts",
  line: 1,
  scope: "next-line",
  rule: "no-alert",
  reason: "The browser fixture deliberately invokes the alert boundary.",
  target: "alert('fixture');",
  fingerprint: "abc123",
  owner: "web",
  verdict: "retain",
  proof: "A planted lint probe fails when the directive is removed.",
  implementationCommit: "deadbeef",
};

const ledger = (entries: readonly unknown[]): string =>
  JSON.stringify({
    version: 1,
    startingSnapshot: {
      commit: "deadbeef",
      rawMatches: 1,
      directives: 1,
      noise: 0,
    },
    entries,
    noiseEntries: [],
  });

void test("rejects unknown entry keys", () => {
  assert.throws(
    () => parseSuppressionLedger(ledger([{ ...entry, ignored: true }])),
    /Invalid ESLint suppression ledger/,
  );
});

void test("rejects duplicate suppression identities", () => {
  assert.throws(
    () => parseSuppressionLedger(ledger([entry, entry])),
    /Duplicate ESLint suppression ledger identity/,
  );
});
