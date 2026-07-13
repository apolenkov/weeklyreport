// Mutation consumer audit — static analysis pass that lists every tRPC
// mutation defined in the API and checks for a likely consumer in the web
// codebase. CI gate: fails if a NEW black-hole mutation appears beyond
// the allowlist.
//
// What this catches: a mutation that's been wired up but its result is
// never read back (the reopen-request bug pattern: tRPC mutation existed,
// toast fired, row never persisted, no UI surfaced it).
//
// Run:
//   node apps/web/uat-suite/mutation-audit.mjs                    # audit + refresh mutation-audit.md
//   node apps/web/uat-suite/mutation-audit.mjs --check            # gate mode: audit only, writes nothing
//   node apps/web/uat-suite/mutation-audit.mjs --update-allowlist

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const ROUTER_PATH = path.join(
  REPO_ROOT,
  "apps/api/src/infrastructure/trpc/trpc.router.ts",
);
const WEB_SRC = path.join(REPO_ROOT, "apps/web/src");
const OUTPUT_MD = path.join(__dirname, "mutation-audit.md");
const ALLOWLIST_PATH = path.join(__dirname, "mutation-audit.allowlist.json");

const router = readFileSync(ROUTER_PATH, "utf8");

function extractProcedures(src) {
  const procs = [];
  const lines = src.split("\n");
  const stack = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nsMatch = line.match(/^\s*(\w+):\s*router\(\{/);
    if (nsMatch) {
      stack.push({ name: nsMatch[1], depth: 1 });
      continue;
    }
    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      top.depth += opens - closes;
      if (top.depth <= 0) {
        stack.pop();
        continue;
      }
    }
    const procMatch = line.match(/^\s*(\w+):\s*\w*Procedure[\s\S]*$/);
    if (procMatch && stack.length > 0) {
      const lookAhead = lines.slice(i, i + 10).join(" ");
      const kindMatch = lookAhead.match(/\.(query|mutation)\(/);
      if (kindMatch) {
        const ns = stack.map((s) => s.name).join(".");
        procs.push({ namespace: ns, name: procMatch[1], kind: kindMatch[1] });
      }
    }
  }
  return procs;
}

const procedures = extractProcedures(router);
const queries = procedures.filter((p) => p.kind === "query");
const mutations = procedures.filter((p) => p.kind === "mutation");

function gripCount(needle) {
  try {
    const out = execFileSync(
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- ripgrep invoked in a dev-only static-analysis uat script; resolved from PATH intentionally
      "rg",
      ["-c", "--no-heading", "-F", needle, WEB_SRC],
      {
        encoding: "utf8",
      },
    );
    return out.split("\n").filter(Boolean).length;
  } catch (error) {
    // rg exits 1 for "no matches" — that is a real zero. Anything else
    // (binary missing, bad invocation, exit >= 2) must fail the audit loudly:
    // a gate that silently counts 0 on a broken tool passes vacuously.
    if (error && typeof error === "object" && error.status === 1) {
      return 0;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[mutation-audit] FAIL: ripgrep invocation broke: ${message}`,
    );
    process.exit(2);
  }
}

const audits = mutations.map((m) => {
  const sameNsQueries = queries.filter((q) => q.namespace === m.namespace);
  const hasList = sameNsQueries.some(
    (q) =>
      /^(list|get|snapshot|find|fetch|count)/i.test(q.name) ||
      /^(by|active|pending)/i.test(q.name),
  );
  const stem = m.name
    .replace(
      /^(save|create|update|delete|remove|upsert|respond|request|publish|revoke|toggle|wipe|reseed|execute)/,
      "",
    )
    .toLowerCase();
  const namedConsumer = sameNsQueries.find((q) =>
    q.name.toLowerCase().includes(stem.slice(0, 4)),
  );
  const refCount = gripCount(`${m.namespace.split(".").pop()}.${m.name}`);

  let status;
  if (hasList || namedConsumer) status = "VERIFIED";
  else if (refCount > 0) status = "PARTIAL";
  else status = "BLACK HOLE";

  return {
    procedure: `${m.namespace}.${m.name}`,
    status,
    consumerQueries: sameNsQueries.map((q) => `${q.namespace}.${q.name}`),
    namedConsumer: namedConsumer
      ? `${namedConsumer.namespace}.${namedConsumer.name}`
      : null,
    refCount,
  };
});

const blackHoles = audits.filter((a) => a.status === "BLACK HOLE");
const partial = audits.filter((a) => a.status === "PARTIAL");
const verified = audits.filter((a) => a.status === "VERIFIED");

let allowlist = {};
if (existsSync(ALLOWLIST_PATH)) {
  try {
    allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  } catch {
    /* empty fallback */
  }
}

const updateMode = process.argv.includes("--update-allowlist");
// Gate mode (pre-push): evaluate and exit-code only — never touch the tree.
// A gate that rewrites a tracked report dirties every push and races
// parallel sessions; report refreshes stay an explicit, deliberate run.
const checkMode = process.argv.includes("--check");
if (updateMode) {
  for (const a of blackHoles) {
    if (!allowlist[a.procedure]) {
      allowlist[a.procedure] = "⚠ TODO: justify or wire a consumer";
    }
  }
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(allowlist, null, 2) + "\n");
  console.log(`[mutation-audit] allowlist updated: ${ALLOWLIST_PATH}`);
}

const unexpectedBlackHoles = blackHoles.filter((a) => !allowlist[a.procedure]);

const lines = ["# Mutation Consumer Audit", ""];
lines.push(`Mutations defined: ${mutations.length}`);
lines.push(`Queries defined: ${queries.length}`);
lines.push("");
lines.push(`- VERIFIED: ${verified.length}`);
lines.push(`- PARTIAL: ${partial.length}`);
lines.push(
  `- BLACK HOLE: ${blackHoles.length} (${unexpectedBlackHoles.length} unexpected)`,
);
lines.push("");

if (unexpectedBlackHoles.length > 0) {
  lines.push("## ⚠ Unexpected black holes (CI fail)");
  lines.push("");
  lines.push(
    "Mutations with no consumer + not in allowlist. Wire a consumer or add to mutation-audit.allowlist.json with justification.",
  );
  lines.push("");
  lines.push("| Procedure | Same-NS queries | Web refs |");
  lines.push("| --- | --- | --: |");
  for (const a of unexpectedBlackHoles) {
    lines.push(
      `| ${a.procedure} | ${a.consumerQueries.length || "—"} | ${a.refCount} |`,
    );
  }
  lines.push("");
}

if (Object.keys(allowlist).length > 0) {
  lines.push("## ✓ Allowlisted (intentional)");
  lines.push("");
  lines.push("| Procedure | Reason |");
  lines.push("| --- | --- |");
  for (const [proc, reason] of Object.entries(allowlist)) {
    lines.push(`| ${proc} | ${reason} |`);
  }
  lines.push("");
}

if (partial.length > 0) {
  lines.push("## ◐ Partial coverage (informational)");
  lines.push("");
  lines.push("| Procedure | Web refs | Same-NS queries |");
  lines.push("| --- | --: | --: |");
  for (const a of partial) {
    lines.push(
      `| ${a.procedure} | ${a.refCount} | ${a.consumerQueries.length || "—"} |`,
    );
  }
  lines.push("");
}

if (!checkMode) {
  writeFileSync(OUTPUT_MD, lines.join("\n"));
}

console.log(`mutations: ${mutations.length}, queries: ${queries.length}`);
console.log(
  `VERIFIED: ${verified.length}, PARTIAL: ${partial.length}, BLACK HOLE: ${blackHoles.length} (${unexpectedBlackHoles.length} unexpected)`,
);

if (unexpectedBlackHoles.length > 0 && !updateMode) {
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
