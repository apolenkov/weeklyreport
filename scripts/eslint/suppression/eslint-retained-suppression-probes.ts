import { readFileSync } from "node:fs";

import { ESLint } from "eslint";

import { readSuppressionInventory } from "./eslint-suppression-inventory.ts";
import { parseSuppressionLedger } from "./eslint-suppression-ledger-schema.ts";

const ledger = parseSuppressionLedger(
  readFileSync(
    "scripts/eslint/suppression/eslint-suppression-ledger.json",
    "utf8",
  ),
);
const retainedKeys = ledger.entries
  .filter((entry) => entry.verdict === "retain")
  .reduce<Map<string, number>>((counts, entry) => {
    const key = `${entry.path}\0${entry.fingerprint}\0${entry.rule}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map());
const retained = readSuppressionInventory().directives.filter((directive) =>
  retainedKeys.has(
    `${directive.path}\0${directive.fingerprint}\0${directive.rule}`,
  ),
);

const byPath = Map.groupBy(retained, (directive) => directive.path);
// Keep the source byte-identical to the checked-in file while disabling every
// inline directive. Rewriting a type-aware lintText input can make the parser
// service and ESLint disagree about source ranges on another platform.
const eslint = new ESLint({
  allowInlineConfig: false,
  cwd: process.cwd(),
});
const failures: string[] = [];

for (const [path, directives] of byPath) {
  const [result] = await eslint.lintFiles([path]);
  const actualCounts = new Map<string, number>();
  for (const message of result?.messages ?? []) {
    if (message.ruleId === null) continue;
    actualCounts.set(
      message.ruleId,
      (actualCounts.get(message.ruleId) ?? 0) + 1,
    );
  }
  const expectedCounts = directives.reduce<Map<string, number>>(
    (counts, directive) =>
      counts.set(directive.rule, (counts.get(directive.rule) ?? 0) + 1),
    new Map(),
  );
  for (const [rule, expected] of expectedCounts) {
    const actual = actualCounts.get(rule) ?? 0;
    if (actual < expected) {
      failures.push(`${path}: ${rule} expected>=${expected} actual=${actual}`);
    }
  }
}

const retainedLedgerCount = [...retainedKeys.values()].reduce(
  (total, count) => total + count,
  0,
);
if (retained.length !== retainedLedgerCount) {
  failures.push(
    `retained ledger/live mismatch ledger=${retainedLedgerCount} live=${retained.length}`,
  );
}

if (failures.length > 0) {
  throw new Error(
    `retained suppression probes failed:\n${failures.join("\n")}`,
  );
}

console.log(
  `retained-suppression-probes PASS directives=${retained.length} files=${byPath.size}`,
);
