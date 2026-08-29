#!/usr/bin/env node
import { readFileSync } from "node:fs";

import {
  readSuppressionInventory,
  type SuppressionDirective,
} from "./eslint-suppression-inventory.ts";
import { parseSuppressionLedger } from "./eslint-suppression-ledger-schema.ts";

const LEDGER_PATH = new URL(
  "./eslint-suppression-ledger.json",
  import.meta.url,
);

const identity = (
  entry: Pick<SuppressionDirective, "path" | "fingerprint" | "rule">,
): string => `${entry.path}\0${entry.fingerprint}\0${entry.rule}`;

const ledger = parseSuppressionLedger(readFileSync(LEDGER_PATH, "utf8"));
const inventory = readSuppressionInventory();
const records = new Map(
  ledger.entries.map((entry) => [identity(entry), entry]),
);
const liveIds = new Set(inventory.directives.map(identity));
const missing = inventory.directives
  .filter((directive) => !records.has(identity(directive)))
  .map(
    (directive) =>
      `missing live directive: ${directive.path}:${directive.line} ${directive.rule}`,
  );
const stale = ledger.entries
  .filter((entry) => !liveIds.has(identity(entry)))
  .map(
    (entry) =>
      `stale retained directive: ${entry.path}:${entry.line} ${entry.rule}`,
  );
const errors = [...missing, ...stale];

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `suppression-ledger PASS retained=${ledger.entries.length}\n`,
);
