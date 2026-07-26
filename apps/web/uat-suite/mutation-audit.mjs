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

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const TRPC_DIR = path.join(REPO_ROOT, "apps/api/src/infrastructure/trpc");
const ROUTER_PATH = path.join(TRPC_DIR, "trpc.router.ts");
const ROUTERS_DIR = path.join(TRPC_DIR, "routers");
const WEB_SRC = path.join(REPO_ROOT, "apps/web/src");
const OUTPUT_MD = path.join(__dirname, "mutation-audit.md");
const ALLOWLIST_PATH = path.join(__dirname, "mutation-audit.allowlist.json");

// Any shape this extractor cannot resolve is a hard stop, never a skip: the
// previous line-based parser silently matched nothing after the router tree
// was split into factories, so the gate passed on an empty set for months.
function fail(message, node) {
  console.error(`[mutation-audit] FAIL: ${message}${locationOf(node)}`);
  process.exit(2);
}

function locationOf(node) {
  if (!node) return "";
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart());
  return ` (${path.relative(REPO_ROOT, source.fileName)}:${line + 1})`;
}

function parseSource(file) {
  const source = readFileSync(file, "utf8");
  // setParentNodes: getSourceFile()/getStart() on nested nodes drive `fail`.
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

function routerSourceFiles() {
  const nested = readdirSync(ROUTERS_DIR, { recursive: true })
    .filter((rel) => rel.endsWith(".ts") && !rel.endsWith(".test.ts"))
    .map((rel) => path.join(ROUTERS_DIR, rel));
  return [ROUTER_PATH, ...nested];
}

// The expression a factory hands back: `=> router({…})` or a `return` in a block.
function returnedExpression(fn) {
  if (!fn.body) return null;
  if (!ts.isBlock(fn.body)) return fn.body;
  return fn.body.statements.find(ts.isReturnStatement)?.expression ?? null;
}

// What a name stands for once resolved: a function contributes what it
// returns, any other binding contributes its initializer.
function declaredValue(initializer) {
  const isFunction =
    ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
  return isFunction ? returnedExpression(initializer) : initializer;
}

function namedDeclaration(node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return { name: node.name.text, expr: returnedExpression(node) };
  }
  const isNamedBinding =
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer;
  if (!isNamedBinding) return null;
  return { name: node.name.text, expr: declaredValue(node.initializer) };
}

// Names are file-local in source but global here; ambiguity fails loud below
// rather than resolving to whichever declaration was parsed last.
function declarationsIn(source) {
  const found = [];
  const visit = (node) => {
    const declaration = namedDeclaration(node);
    if (declaration) found.push(declaration);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

const DECLARATIONS = routerSourceFiles()
  .map(parseSource)
  .flatMap(declarationsIn)
  .reduce(
    (map, declaration) =>
      map.set(declaration.name, [
        ...(map.get(declaration.name) ?? []),
        declaration.expr,
      ]),
    new Map(),
  );

function lookupDeclaration(name, node) {
  const matches = DECLARATIONS.get(name) ?? [];
  if (matches.length === 1) return matches[0];
  const reason =
    matches.length === 0
      ? `unknown router binding \`${name}\``
      : `ambiguous router binding \`${name}\` (${matches.length} declarations)`;
  return fail(reason, node);
}

function resolveCall(expr) {
  const callee = expr.expression;
  if (ts.isPropertyAccessExpression(callee)) {
    const kind = callee.name.text;
    if (kind === "query" || kind === "mutation")
      return { type: "procedure", kind };
    return null;
  }
  if (!ts.isIdentifier(callee)) return null;
  if (callee.text === "router") return resolveExpression(expr.arguments[0]);
  return resolveExpression(lookupDeclaration(callee.text, callee));
}

// A namespace (`router({…})` or the bare object a `*Procedures` factory
// returns) or a single procedure — a factory call looks identical either way
// at the call site, so only its return expression settles which.
function resolveExpression(expr) {
  if (!expr) return null;
  if (ts.isCallExpression(expr)) return resolveCall(expr);
  if (ts.isIdentifier(expr)) {
    return resolveExpression(lookupDeclaration(expr.text, expr));
  }
  if (ts.isObjectLiteralExpression(expr)) {
    return { type: "namespace", entries: expr.properties.flatMap(entriesOf) };
  }
  return null;
}

function entriesOf(property) {
  if (ts.isPropertyAssignment(property)) {
    return [{ name: property.name.getText(), expr: property.initializer }];
  }
  if (ts.isShorthandPropertyAssignment(property)) {
    return [{ name: property.name.text, expr: property.name }];
  }
  if (!ts.isSpreadAssignment(property)) {
    return fail("unsupported router member", property);
  }
  const spread = resolveExpression(property.expression);
  if (spread?.type !== "namespace") {
    return fail("spread member is not a procedure group", property);
  }
  return spread.entries;
}

function flattenProcedures(node, trail) {
  if (node.type === "procedure") {
    return [
      {
        namespace: trail.slice(0, -1).join("."),
        name: trail.at(-1),
        kind: node.kind,
      },
    ];
  }
  return node.entries.flatMap((entry) => {
    const resolved =
      resolveExpression(entry.expr) ??
      fail(
        `cannot classify \`${[...trail, entry.name].join(".")}\``,
        entry.expr,
      );
    return flattenProcedures(resolved, [...trail, entry.name]);
  });
}

// Namespaces come from how createAppRouter composes the factories, so a
// reported name matches what a web caller writes: trpc.<namespace>.<procedure>.
function extractProcedures() {
  const root = resolveExpression(lookupDeclaration("createAppRouter"));
  if (root?.type !== "namespace") {
    return fail("createAppRouter does not resolve to a router");
  }
  return flattenProcedures(root, []);
}

const procedures = extractProcedures();
const queries = procedures.filter((p) => p.kind === "query");
const mutations = procedures.filter((p) => p.kind === "mutation");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

// Read once: every mutation is looked up against the same corpus, and shelling
// out per procedure needed ripgrep on PATH — which no CI runner here has. That
// dependency stayed invisible while the extractor was broken, because a gate
// finding zero procedures never reaches this function.
const webSources = (function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name))
      ? [readFileSync(full, "utf8")]
      : [];
  });
})(WEB_SRC);

const gripCount = (needle) =>
  webSources.filter((source) => source.includes(needle)).length;

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
  // An empty stem would make `includes("")` true for every sibling query, so a
  // mutation named exactly `publish` or `save` would match unconditionally.
  const stemKey = stem.slice(0, 4);
  const namedConsumer =
    stemKey === ""
      ? undefined
      : sameNsQueries.find((q) => q.name.toLowerCase().includes(stemKey));
  const refCount = gripCount(`${m.namespace.split(".").pop()}.${m.name}`);

  // Whether the web app calls this mutation decides; the sibling-query
  // heuristics only say whether the caller can read the result back. Consulting
  // them first is what let a procedure with zero consumers report VERIFIED
  // because some unrelated `list*` query happened to share its namespace.
  const status =
    refCount === 0
      ? "BLACK HOLE"
      : hasList || namedConsumer
        ? "VERIFIED"
        : "PARTIAL";

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
