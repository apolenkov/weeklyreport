#!/usr/bin/env node
// Stage D batch generator (P5): builds the SLICES per-run config for
// .claude/workflows/waveb-batch-review.js (and waveb-batch.js) straight from
// the triage ledger, so slice lists are never hand-edited. Routing comes from
// the ledger's `lane` column (see LANE-ROUTING.md); gate tier follows the P2
// rules. Hard-fails on any file intersection between selected slices.
//
// Usage:
//   node .claude/scripts/generate-slices.mjs --plan [--lane grok]
//   node .claude/scripts/generate-slices.mjs --seams api/email,web/review \
//     --target .claude/workflows/waveb-batch-review.js [--gate full] [--dry]
//   node .claude/scripts/generate-slices.mjs --lane grok --count 4 --target ...

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEDGER = join(
  ROOT,
  "openspec/changes/good-to-exemplary-triage/class-distribution.json",
);
const MARKER_START = "// ---- per-run config";
const MARKER_END = "// ----------";
const L_TIER_THRESHOLD = 17;
const FULL_TIER_PATH = /^(prisma\/|packages\/shared\/)/;
const API_NON_TEST = /^apps\/api\/(?!.*\.(test|spec)\.tsx?$).*\.tsx?$/;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};

const seamOf = (file) => {
  const rules = [
    [/^apps\/api\/src\/modules\/([^/]+)\//, (m) => `api/${m[1]}`],
    [/^apps\/api\/src\/infrastructure\//, () => "api/infrastructure"],
    [/^apps\/api\/src\/lib\//, () => "api/lib"],
    [/^apps\/api\//, () => "api/other"],
    [/^apps\/web\/src\/features\/([^/]+)\//, (m) => `web/${m[1]}`],
    [/^apps\/web\/src\/app\//, () => "web/app"],
    [/^apps\/web\/src\/shared\//, () => "web/shared"],
    [/^apps\/web\/src\/lib\//, () => "web/lib"],
    [/^apps\/web\/src\/hooks\//, () => "web/hooks"],
    [/^apps\/web\/src\/test-utils\//, () => "web/test-utils"],
    [/^apps\/web\//, () => "web/other"],
    [/^packages\/shared\//, () => "packages/shared"],
    [/^packages\/ui\//, () => "packages/ui"],
    [/^prisma\//, () => "prisma"],
    [/^e2e\//, () => "e2e"],
    [/^scripts\//, () => "scripts"],
  ];
  const hit = rules.find(([re]) => re.test(file));
  return hit ? hit[1](file.match(hit[0])) : "misc";
};

const ledger = JSON.parse(readFileSync(LEDGER, "utf8"));
const pending = ledger.findings.filter((f) => f.disposition === "pending");
const laneFilter = opt("lane");
const rows = laneFilter
  ? pending.filter((f) => f.lane === laneFilter)
  : pending;

const seams = [
  ...rows.reduce((acc, f) => {
    const key = seamOf(f.file);
    return acc.set(key, [...(acc.get(key) ?? []), f]);
  }, new Map()),
].map(([name, findings]) => ({
  name,
  findings,
  files: [...new Set(findings.map((f) => f.file))],
  lanes: [...new Set(findings.map((f) => f.lane))].sort(),
}));

if (flag("plan") || (!opt("seams") && !opt("count"))) {
  const sorted = [...seams].sort(
    (a, b) => b.findings.length - a.findings.length,
  );
  const laneNote = laneFilter ? ` [lane=${laneFilter}]` : "";
  console.log(
    `pending${laneNote}: ${rows.length} findings, ${sorted.length} seams\n`,
  );
  sorted.forEach((s) => {
    const tier =
      s.findings.length >= L_TIER_THRESHOLD
        ? "L"
        : s.findings.length >= 9
          ? "M"
          : "S";
    console.log(
      `${tier}  ${s.name.padEnd(24)} ${String(s.findings.length).padStart(3)} findings  ${String(s.files.length).padStart(3)} files  lanes:${s.lanes.join(",")}`,
    );
  });
  process.exit(0);
}

const wanted = opt("seams")
  ? opt("seams")
      .split(",")
      .map((s) => s.trim())
  : [...seams]
      .sort((a, b) => a.findings.length - b.findings.length)
      .slice(0, Number(opt("count")))
      .map((s) => s.name);

const selected = wanted.map((name) => {
  const seam = seams.find((s) => s.name === name);
  if (!seam) throw new Error(`seam not found or has no pending rows: ${name}`);
  return seam;
});

const overlaps = selected.flatMap((a, i) =>
  selected.slice(i + 1).flatMap((b) => {
    const shared = a.files.filter((f) => b.files.includes(f));
    return shared.length ? [`${a.name} ∩ ${b.name}: ${shared.join(", ")}`] : [];
  }),
);
if (overlaps.length) {
  throw new Error(`slices are not file-disjoint:\n${overlaps.join("\n")}`);
}

const autoTier = selected.some(
  (s) =>
    s.findings.length >= L_TIER_THRESHOLD ||
    s.files.some((f) => FULL_TIER_PATH.test(f) || API_NON_TEST.test(f)),
)
  ? "full"
  : "fast";
const gateTier = opt("gate") ?? autoTier;

const briefOf = (s) =>
  `${s.findings.length} pending findings (lanes: ${s.lanes.join(",")}). Verify EACH is genuinely fixed or honestly recorded stale against the ledger: ` +
  s.findings
    .map(
      (f) =>
        `${f.id} [${f.class}] ${f.file.split("/").pop()}:${f.line} — ${f.issue}`,
    )
    .join(" · ");

const slicesJs = selected
  .map((s) =>
    [
      "  {",
      `    name: ${JSON.stringify(s.name.replace("/", "-"))},`,
      `    lane: ${JSON.stringify(s.lanes.length === 1 ? s.lanes[0] : "mixed")},`,
      `    files: [\n${s.files.map((f) => "      " + JSON.stringify(f) + ",").join("\n")}\n    ],`,
      `    brief: ${JSON.stringify(briefOf(s))},`,
      "  },",
    ].join("\n"),
  )
  .join("\n");

const tierComment =
  gateTier === autoTier
    ? "auto (P2 rules)"
    : `override (auto said ${autoTier})`;
const block = [
  `${MARKER_START}: generated by .claude/scripts/generate-slices.mjs — do not hand-edit ----`,
  `const SLICES = [\n${slicesJs}\n];`,
  `const GATE_TIER = ${JSON.stringify(gateTier)}; // ${tierComment}`,
  MARKER_END,
].join("\n");

const sliceSummary = selected
  .map((s) => `${s.name}(${s.findings.length})`)
  .join(", ");
console.log(`slices: ${sliceSummary}`);
const tierNote = gateTier !== autoTier ? ` (override; auto=${autoTier})` : "";
console.log(`gate tier: ${gateTier}${tierNote}`);

const target = opt("target");
if (!target) {
  console.log(`\n${block}`);
  process.exit(0);
}

const targetPath = join(ROOT, target);
const source = readFileSync(targetPath, "utf8");
const startIdx = source.indexOf(MARKER_START);
const endIdx = source.indexOf(MARKER_END, startIdx);
if (startIdx < 0 || endIdx < 0) {
  throw new Error(
    `markers not found in ${target} (need "${MARKER_START}" … "${MARKER_END}")`,
  );
}
const next =
  source.slice(0, startIdx) + block + source.slice(endIdx + MARKER_END.length);

if (flag("dry")) {
  console.log(`\n--dry: would write ${target}\n\n${block}`);
  process.exit(0);
}

writeFileSync(targetPath, next);
execFileSync(
  join(ROOT, "node_modules", ".bin", "prettier"),
  ["--write", target],
  {
    cwd: ROOT,
    stdio: "inherit",
  },
);
console.log(`wrote ${target} and ran prettier`);
