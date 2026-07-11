#!/usr/bin/env node
// Status-SSOT literal-union detector (status-type-ssot-gate spec). The two
// status vocabularies live ONLY in packages/shared report-primitives.schema.ts;
// this gate fails any union type or z.enum that re-declares them elsewhere:
//   - traffic light: a literal set containing ALL of green/yellow/red
//     (extras allowed — the three colors only ever come from the SSOT);
//   - report status: a literal set EXACTLY {draft, published} (supersets are
//     distinct vocabularies by traced evidence and stay a review judgment).
//
// Usage:
//   node scripts/find-status-literal-unions.mjs --all            # whole tree
//   node scripts/find-status-literal-unions.mjs <file> [file...] # given files
// (lint-staged passes staged files as args; --all is the manual/`pnpm lint`
// sweep.) Exits 1 if any hit is found, so it can gate a commit.
//
// Exceptions are central and hardcoded — no inline escape, so a violation
// cannot be locally suppressed. Future carve-outs edit ALLOWLIST and the test.
import fs from "node:fs";
import path from "node:path";

const ALL = process.argv.includes("--all");
const argPaths = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const TRAFFIC = ["green", "yellow", "red"];
const REPORT = ["draft", "published"];

// The SSOT itself, plus the documented literal mirror whose tsconfig cannot
// resolve workspace packages (report-status-type spec carve-out).
const ALLOWLIST = [
  "packages/shared/src/schemas/report-primitives.schema.ts",
  "prisma/seed-constants.ts",
];

const IGNORE =
  /(^|\/)(node_modules|dist|\.next[^/]*|coverage|build|openspec\/changes\/archive)\//;
// Tests ARE covered (the gate is hollow otherwise) — only generated and
// vendored trees are skipped.
const isScannable = (f) =>
  /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f) && !IGNORE.test(f);

const isAllowlisted = (f) => {
  const normalized = path.resolve(f).split(path.sep).join("/");
  return ALLOWLIST.some((entry) => normalized.endsWith(`/${entry}`));
};

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (IGNORE.test(`${p}/`)) return [];
    return e.isDirectory() ? walk(p) : [p];
  });

const files = (
  ALL
    ? ["apps", "packages", "prisma", "e2e"]
        .filter((d) => fs.existsSync(d))
        .flatMap(walk)
    : argPaths
).filter((f) => isScannable(f) && !isAllowlisted(f));

// Judge code only: block comments and line comments carry no declarations.
// The `[^:]` guard keeps `https://...` inside string literals intact.
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const literalsOf = (span) =>
  [...span.matchAll(/["']([^"'\n]*)["']/g)].map((m) => m[1]);

const violation = (literals) => {
  const set = new Set(literals);
  if (TRAFFIC.every((color) => set.has(color))) {
    return "re-declares the TrafficLightStatus union — import it from @customreport/shared (report-primitives.schema.ts)";
  }
  const isExactReportStatus =
    set.size === REPORT.length && REPORT.every((status) => set.has(status));
  if (isExactReportStatus) {
    return "re-declares the ReportStatus union — import it from @customreport/shared (report-primitives.schema.ts)";
  }
  return null;
};

// A union chain: two or more string literals joined by `|` (newlines legal),
// or a z.enum literal list. Array `as const` declarations are value lists,
// not type re-declarations, and stay out of scope (status-type-ssot-gate).
const UNION_CHAIN = /["'][^"'\n]*["'](?:\s*\|\s*["'][^"'\n]*["'])+/g;
const Z_ENUM = /z\.enum\(\s*\[([^\]]*)\]/g;

const lineAt = (source, index) => source.slice(0, index).split("\n").length;

const scanFile = (file) => {
  const source = stripComments(fs.readFileSync(file, "utf8"));
  return [...source.matchAll(UNION_CHAIN), ...source.matchAll(Z_ENUM)].flatMap(
    (match) => {
      const label = violation(literalsOf(match[0]));
      return label ? [`  ${lineAt(source, match.index)}: ${label}`] : [];
    },
  );
};

const perFile = new Map(
  files.map((f) => [f, scanFile(f)]).filter(([, hits]) => hits.length > 0),
);

const total = [...perFile.values()].reduce((n, h) => n + h.length, 0);
for (const [f, hits] of perFile) console.log(`\n${f}\n${hits.join("\n")}`);
console.log(
  `\n${total} status literal-union hit(s) in ${perFile.size} file(s).`,
);
process.exit(total ? 1 : 0);
