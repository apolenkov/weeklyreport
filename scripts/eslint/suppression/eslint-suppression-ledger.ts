#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

import {
  readSuppressionInventory,
  readSuppressionInventoryAtCommit,
  type SuppressionDirective,
} from "./eslint-suppression-inventory.ts";
import {
  parseSuppressionLedger,
  type SuppressionLedger as Ledger,
} from "./eslint-suppression-ledger-schema.ts";

const LEDGER_PATH = new URL(
  "./eslint-suppression-ledger.json",
  import.meta.url,
);
const START_COMMIT = "63e60d8b";
const START_RAW_MATCHES = 126;
const START_DIRECTIVES = 115;
const START_NOISE = 11;

const ownerOf = (path: string): string => {
  if (path.startsWith("apps/api/src/")) return "api";
  if (path.startsWith("apps/web/")) return "web";
  if (path.startsWith("packages/")) return "package";
  if (path.startsWith("prisma/")) return "seed";
  // Historical owner needed to reproduce the immutable starting snapshot.
  if (path.startsWith("e2e/")) return "e2e";
  if (path.startsWith("scripts/") || path.startsWith("tools/"))
    return "tooling";
  return "configuration";
};

const identity = (
  entry: Pick<SuppressionDirective, "path" | "fingerprint" | "rule">,
): string => `${entry.path}\0${entry.fingerprint}\0${entry.rule}`;

const initialLedger = (): Ledger => {
  const inventory = readSuppressionInventoryAtCommit(START_COMMIT);
  return {
    version: 1,
    startingSnapshot: {
      commit: START_COMMIT,
      rawMatches: START_RAW_MATCHES,
      directives: START_DIRECTIVES,
      noise: START_NOISE,
    },
    entries: inventory.directives.map((directive) => ({
      ...directive,
      owner: ownerOf(directive.path),
      verdict: "unadjudicated",
      proof: null,
      implementationCommit: null,
    })),
    noiseEntries: inventory.noise.map((entry) => ({
      ...entry,
      verdict: "replace",
      reason:
        "Raw substring was not an ESLint directive; the catalogue now parses directive comments.",
      implementationCommit: "pending-ledger-commit",
    })),
  };
};

const readLedger = (): Ledger =>
  parseSuppressionLedger(readFileSync(LEDGER_PATH, "utf8"));

const violations = (ledger: Ledger, complete: boolean): readonly string[] => {
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
    .filter(
      (entry) =>
        (entry.verdict === "retain" || entry.verdict === "unadjudicated") &&
        !liveIds.has(identity(entry)),
    )
    .map(
      (entry) =>
        `stale ${entry.verdict} record: ${entry.path}:${entry.line} ${entry.rule}`,
    );
  const resolvedStillLive = ledger.entries
    .filter(
      (entry) =>
        (entry.verdict === "remove" || entry.verdict === "replace") &&
        liveIds.has(identity(entry)),
    )
    .map(
      (entry) =>
        `${entry.verdict} still live: ${entry.path}:${entry.line} ${entry.rule}`,
    );
  const incomplete = ledger.entries
    .filter(
      (entry) =>
        complete &&
        (entry.verdict === "unadjudicated" ||
          entry.implementationCommit === null ||
          (entry.verdict === "retain" && entry.proof === null)),
    )
    .map(
      (entry) => `incomplete record: ${entry.path}:${entry.line} ${entry.rule}`,
    );
  const snapshot = ledger.startingSnapshot;
  const snapshotErrors = [
    snapshot.rawMatches === START_RAW_MATCHES
      ? undefined
      : `starting raw baseline must be ${START_RAW_MATCHES}`,
    snapshot.directives === START_DIRECTIVES
      ? undefined
      : `starting directive baseline must be ${START_DIRECTIVES}`,
    snapshot.noise === START_NOISE
      ? undefined
      : `starting noise baseline must be ${START_NOISE}`,
    ledger.entries.length === snapshot.directives
      ? undefined
      : "starting directive records do not match snapshot",
    ledger.noiseEntries.length === snapshot.noise
      ? undefined
      : "starting noise records do not match snapshot",
  ].filter((message): message is string => message !== undefined);
  return [
    ...snapshotErrors,
    ...missing,
    ...stale,
    ...resolvedStillLive,
    ...incomplete,
  ];
};

const mode = process.argv[2] ?? "--check";
if (mode === "--init") {
  writeFileSync(LEDGER_PATH, `${JSON.stringify(initialLedger(), null, 2)}\n`);
  process.stdout.write(
    `suppression ledger initialized at ${LEDGER_PATH.pathname}\n`,
  );
  process.exit(0);
}
if (mode !== "--check" && mode !== "--complete") {
  process.stderr.write(
    "usage: tsx scripts/eslint/suppression/eslint-suppression-ledger.ts [--init|--check|--complete]\n",
  );
  process.exit(2);
}

const ledger = readLedger();
const errors = violations(ledger, mode === "--complete");
if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}
const live = readSuppressionInventory().directives.length;
const adjudicated = ledger.entries.filter(
  (entry) => entry.verdict !== "unadjudicated",
).length;
process.stdout.write(
  `suppression-ledger PASS live=${live} adjudicated=${adjudicated}/${ledger.entries.length} noise=${ledger.noiseEntries.length}\n`,
);
