#!/usr/bin/env node
/**
 * Cross-reference matrix builder.
 *
 * Inputs:
 *   - apps/web/.tmp/uat-suite/inventory.md     (268 interactive nodes × 16 (role,route) tuples)
 *   - .planning/REGRESSION-TEST-SCENARIOS.md   (430+ enumerated scenarios)
 *
 * Output:
 *   - apps/web/.tmp/uat-suite/coverage-matrix.csv   (every applicable node × scenario pairing)
 *   - apps/web/.tmp/uat-suite/coverage-matrix.json  (chunked for downstream agents)
 *
 * Affinity rules (route → applicable section prefixes):
 *   /lead/report             → LEAD, LEAD-VAL, NAV, DS, A11Y
 *   /lead/history            → ARC, NAV
 *   /reports/history         → ARC, NAV
 *   /reports/trends          → DASH, NAV
 *   /head/dashboard          → DASH, NAV
 *   /head/report             → REV, PRINT, NAV
 *   /admin?tab=users         → ADM (001..060), NAV
 *   /admin?tab=products      → ADM (061..100), NAV
 *   /admin?tab=periods       → ADM (101..120), NAV
 *   /admin?tab=reminders     → ADM (121..140), NAV
 *   /admin?tab=reopen        → ADM (141..160), NAV
 *   /admin?tab=settings      → ADM (161..180), NAV
 *
 * Cross-cutting: every (role, route) gets AUTH, RESP, A11Y, SEC, PERF folded in
 * (these scenarios test page-level concerns, not specific elements).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");

const inventoryPath = join(here, "inventory.md");
const scenariosPath = join(repoRoot, ".planning/REGRESSION-TEST-SCENARIOS.md");
const csvOut = join(here, "coverage-matrix.csv");
const jsonOut = join(here, "coverage-matrix.json");

// ─── Parse inventory ────────────────────────────────────────────────
const inventoryText = readFileSync(inventoryPath, "utf8");
const sections = inventoryText.split(/^## /m).slice(1); // [0] = summary table, drop
const nodes = [];

for (const section of sections) {
  const headerMatch = section.match(/^(\S+)\s+→\s+`([^`]+)`/);
  if (!headerMatch) continue;
  const [, role, route] = headerMatch;
  const lines = section.split("\n");
  for (const line of lines) {
    const m = line.match(
      /^\|\s+(\d+)\s+\|\s+([^|]+?)\s+\|\s+([^|]*?)\s+\|\s+([^|]*?)\s+\|\s+([^|]*?)\s+\|/,
    );
    if (!m) continue;
    const [, idx, kind, label, testid, href] = m;
    if (kind === "Kind") continue; // header row
    nodes.push({
      role: role.trim(),
      route: route.trim(),
      idx: Number(idx),
      kind: kind.trim(),
      label: label.trim(),
      testid: testid.trim().replace(/^—$/, ""),
      href: href.trim().replace(/^—$/, ""),
    });
  }
}

console.log(`Parsed ${nodes.length} nodes from inventory`);

// ─── Parse scenarios ────────────────────────────────────────────────
const scenariosText = readFileSync(scenariosPath, "utf8");
const scenarioRe =
  /^\|\s+([A-Z][A-Z0-9-]*-\d+[a-z]?)\s+\|\s+([^|]+?)\s+\|\s+(P[0-3])\s+\|\s+([^|]+?)\s+\|/gm;
const scenarios = [];
let m;
while ((m = scenarioRe.exec(scenariosText))) {
  const [, id, scenario, priority, expected] = m;
  const prefix = id.split("-")[0];
  const num = Number(id.split("-")[1].replace(/[a-z]$/, ""));
  scenarios.push({
    id,
    prefix,
    num,
    priority,
    scenario: scenario.trim(),
    expected: expected.trim(),
  });
}

console.log(`Parsed ${scenarios.length} scenarios`);

// ─── Affinity map ───────────────────────────────────────────────────
const PAGE_AFFINITY = [
  {
    match: "/lead/report",
    prefixes: ["LEAD", "NAV", "DS", "A11Y", "RESP", "AUTH", "ZOD", "E2E"],
  },
  {
    match: "/lead/history",
    prefixes: ["ARC", "NAV", "A11Y", "RESP", "AUTH", "E2E"],
  },
  {
    match: "/reports/history",
    prefixes: ["ARC", "NAV", "A11Y", "RESP", "AUTH", "E2E"],
  },
  {
    match: "/reports/trends",
    prefixes: ["DASH", "NAV", "A11Y", "RESP", "AUTH"],
  },
  {
    match: "/head/dashboard",
    prefixes: ["DASH", "NAV", "A11Y", "RESP", "AUTH", "E2E"],
  },
  {
    match: "/head/report",
    prefixes: ["REV", "PRINT", "NAV", "A11Y", "RESP", "AUTH", "E2E"],
  },
  {
    match: "/admin?tab=users",
    prefixes: ["ADM", "NAV", "A11Y", "AUTH", "SEC"],
    range: [1, 60],
  },
  {
    match: "/admin?tab=products",
    prefixes: ["ADM", "NAV", "A11Y", "AUTH"],
    range: [61, 100],
  },
  {
    match: "/admin?tab=periods",
    prefixes: ["ADM", "NAV", "A11Y", "AUTH"],
    range: [101, 120],
  },
  {
    match: "/admin?tab=reminders",
    prefixes: ["ADM", "NAV", "A11Y", "AUTH", "REM"],
    range: [121, 140],
  },
  {
    match: "/admin?tab=reopen",
    prefixes: ["ADM", "NAV", "A11Y", "AUTH"],
    range: [141, 160],
  },
  {
    match: "/admin?tab=settings",
    prefixes: ["ADM", "NAV", "A11Y", "AUTH"],
    range: [161, 180],
  },
];

// Cross-cutting prefixes apply to every node regardless of route.
const CROSS_CUTTING = new Set(["SEC", "PERF", "INFRA", "DB", "ZOD", "E2E"]);

function applicableScenarios(node) {
  const aff = PAGE_AFFINITY.find((a) => node.route === a.match);
  return scenarios.filter((s) => {
    if (CROSS_CUTTING.has(s.prefix)) return true;
    if (!aff) return false;
    if (!aff.prefixes.includes(s.prefix)) return false;
    if (s.prefix === "ADM" && aff.range) {
      return s.num >= aff.range[0] && s.num <= aff.range[1];
    }
    return true;
  });
}

// ─── Cross-product ──────────────────────────────────────────────────
const pairings = [];
for (const node of nodes) {
  const apps = applicableScenarios(node);
  for (const sc of apps) {
    pairings.push({
      role: node.role,
      route: node.route,
      nodeIdx: node.idx,
      nodeKind: node.kind,
      nodeLabel: node.label,
      nodeTestid: node.testid,
      scenarioId: sc.id,
      scenarioPriority: sc.priority,
      scenarioText: sc.scenario,
    });
  }
}

console.log(`Generated ${pairings.length} pairings`);

// ─── Write CSV ──────────────────────────────────────────────────────
const csvHeader =
  "role,route,nodeIdx,nodeKind,nodeLabel,nodeTestid,scenarioId,priority,scenarioText\n";
const csvRows = pairings.map((p) => {
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  return [
    p.role,
    p.route,
    p.nodeIdx,
    p.nodeKind,
    esc(p.nodeLabel),
    p.nodeTestid,
    p.scenarioId,
    p.scenarioPriority,
    esc(p.scenarioText),
  ].join(",");
});
writeFileSync(csvOut, csvHeader + csvRows.join("\n") + "\n");

// ─── Write JSON chunked ─────────────────────────────────────────────
const CHUNK_SIZE = 200;
const chunks = [];
for (let i = 0; i < pairings.length; i += CHUNK_SIZE) {
  chunks.push({
    chunk: chunks.length,
    range: [i, Math.min(i + CHUNK_SIZE, pairings.length) - 1],
    pairings: pairings.slice(i, i + CHUNK_SIZE),
  });
}
writeFileSync(
  jsonOut,
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      nodeCount: nodes.length,
      scenarioCount: scenarios.length,
      pairingCount: pairings.length,
      chunkSize: CHUNK_SIZE,
      chunkCount: chunks.length,
      byPriority: {
        P0: pairings.filter((p) => p.scenarioPriority === "P0").length,
        P1: pairings.filter((p) => p.scenarioPriority === "P1").length,
        P2: pairings.filter((p) => p.scenarioPriority === "P2").length,
        P3: pairings.filter((p) => p.scenarioPriority === "P3").length,
      },
      byRoute: Object.fromEntries(
        Object.entries(
          pairings.reduce((acc, p) => {
            const k = `${p.role} ${p.route}`;
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
          }, {}),
        ).sort((a, b) => b[1] - a[1]),
      ),
      chunks,
    },
    null,
    2,
  ),
);

console.log(`CSV: ${csvOut}`);
console.log(`JSON: ${jsonOut}`);
console.log(`Chunks of ${CHUNK_SIZE}: ${chunks.length}`);
