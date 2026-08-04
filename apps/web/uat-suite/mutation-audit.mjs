// Mutation consumer audit — static analysis pass that lists every tRPC
// mutation defined in the API and checks what the web app does with it.
// CI gate: fails if a NEW black-hole mutation appears beyond the allowlist.
//
// What this catches: a mutation that's been wired up but its result is never
// read back (the reopen-request bug pattern: tRPC mutation existed, toast
// fired, row never persisted, no UI surfaced it).
//
// - BLACK HOLE: no web caller at all.
// - VERIFIED:   every call site invalidates a real query (or navigates away)
//               on its success path — the user sees the result.
// - PARTIAL:    a call site's success path was followed end to end and runs no
//               read-back.
// - UNRESOLVED: a call site's success path leaves the source (a callback handed
//               in, a key built elsewhere); a human has to look.
//
// Run:
//   node apps/web/uat-suite/mutation-audit.mjs                    # audit + refresh mutation-audit.md
//   node apps/web/uat-suite/mutation-audit.mjs --check            # gate mode: audit only, writes nothing
//   node apps/web/uat-suite/mutation-audit.mjs --update-allowlist

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditReadBack } from "./read-back-analysis.mjs";
import { parseMutationAllowlist } from "./mutation-allowlist.mjs";
import { extractProcedures } from "./trpc-procedures.mjs";
import { webSourceTexts } from "./web-module-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_MD = path.join(HERE, "mutation-audit.md");
const ALLOWLIST_PATH = path.join(HERE, "mutation-audit.allowlist.json");

const procedures = extractProcedures();
const queries = procedures.filter((p) => p.kind === "query");
const mutations = procedures.filter((p) => p.kind === "mutation");
const queryPaths = new Set(queries.map((q) => `${q.namespace}.${q.name}`));

// Whether the web app calls a mutation at all is a text question, and stays
// one: the read-back analysis below only speaks about mutations that do.
const referenceCount = (procedure) => {
  const needle = `${procedure.namespace.split(".").pop()}.${procedure.name}`;
  return webSourceTexts.filter((source) => source.includes(needle)).length;
};

const audits = mutations.map((m) => {
  const procedure = `${m.namespace}.${m.name}`;
  const refCount = referenceCount(m);
  if (refCount === 0) {
    return { procedure, refCount, status: "BLACK HOLE", callSites: 0 };
  }
  return { procedure, refCount, ...auditReadBack(procedure, queryPaths) };
});

const withStatus = (status) => audits.filter((a) => a.status === status);
const blackHoles = withStatus("BLACK HOLE");
const partial = withStatus("PARTIAL");
const unresolved = withStatus("UNRESOLVED");
const verified = withStatus("VERIFIED");

function readAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return {};
  return parseMutationAllowlist(readFileSync(ALLOWLIST_PATH, "utf8"));
}

const updateMode = process.argv.includes("--update-allowlist");
// Gate mode (pre-push): evaluate and exit-code only — never touch the tree.
// A gate that rewrites a tracked report dirties every push and races
// parallel sessions; report refreshes stay an explicit, deliberate run.
const checkMode = process.argv.includes("--check");

const allowlist = readAllowlist();
const unexpectedBlackHoles = blackHoles.filter((a) => !allowlist[a.procedure]);

if (updateMode) {
  console.error(
    "[mutation-audit] --update-allowlist cannot generate reviewed justifications; edit mutation-audit.allowlist.json explicitly",
  );
}

const table = (headers, alignment, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${alignment.join(" | ")} |`,
  ...rows.map((cells) => `| ${cells.join(" | ")} |`),
  "",
];

const section = (heading, blurb, body) => [heading, "", blurb, "", ...body];

const blackHoleSection = () =>
  unexpectedBlackHoles.length === 0
    ? []
    : section(
        "## ⚠ Unexpected black holes (CI fail)",
        "Mutations with no consumer + not in allowlist. Wire a consumer or add to mutation-audit.allowlist.json with justification.",
        table(
          ["Procedure", "Web refs"],
          ["---", "--:"],
          unexpectedBlackHoles.map((a) => [a.procedure, a.refCount]),
        ),
      );

const allowlistSection = () =>
  Object.keys(allowlist).length === 0
    ? []
    : section(
        "## ✓ Allowlisted (intentional)",
        "Black holes with a standing justification.",
        table(
          ["Procedure", "Reason"],
          ["---", "---"],
          Object.entries(allowlist),
        ),
      );

const gapSection = (heading, blurb, entries, reasonHeader) =>
  entries.length === 0
    ? []
    : section(
        heading,
        blurb,
        table(
          ["Procedure", "Call sites", reasonHeader],
          ["---", "--:", "---"],
          entries.map((a) => [a.procedure, a.callSites, a.detail]),
        ),
      );

const lines = [
  "# Mutation Consumer Audit",
  "",
  `Mutations defined: ${mutations.length}`,
  `Queries defined: ${queries.length}`,
  "",
  "A mutation is VERIFIED only when every web call site invalidates a real",
  "query (or navigates the page) on its success path. Sibling query names are",
  "not evidence and are not consulted.",
  "",
  `- VERIFIED: ${verified.length}`,
  `- PARTIAL: ${partial.length}`,
  `- UNRESOLVED: ${unresolved.length}`,
  `- BLACK HOLE: ${blackHoles.length} (${unexpectedBlackHoles.length} unexpected)`,
  "",
  ...blackHoleSection(),
  ...allowlistSection(),
  ...gapSection(
    "## ◐ No read-back found (informational)",
    "The success path was followed end to end and refreshes nothing. Either the caller re-reads by another route, or the user is looking at stale data.",
    partial,
    "What runs on success",
  ),
  ...gapSection(
    "## ? Not classifiable from source (informational)",
    "The success path leaves what static analysis can see. Not a defect on its own — a place the audit declines to guess.",
    unresolved,
    "What could not be followed",
  ),
  ...gapSection(
    "## ✓ Read-back wired",
    "The evidence found on each success path.",
    verified,
    "Evidence",
  ),
];

if (!checkMode) {
  writeFileSync(OUTPUT_MD, lines.join("\n"));
}

console.log(`mutations: ${mutations.length}, queries: ${queries.length}`);
console.log(
  `VERIFIED: ${verified.length}, PARTIAL: ${partial.length}, UNRESOLVED: ${unresolved.length}, BLACK HOLE: ${blackHoles.length} (${unexpectedBlackHoles.length} unexpected)`,
);

if (unexpectedBlackHoles.length > 0 || updateMode) {
  console.error(
    `\n[mutation-audit] FAIL: ${unexpectedBlackHoles.length} unexpected black hole(s):`,
  );
  for (const a of unexpectedBlackHoles) {
    console.error(`  - ${a.procedure}`);
  }
  console.error(
    "\nWire a consumer or add to apps/web/uat-suite/mutation-audit.allowlist.json with justification.",
  );
  process.exit(1);
}

console.log(checkMode ? "[mutation-audit] check passed" : `wrote ${OUTPUT_MD}`);
