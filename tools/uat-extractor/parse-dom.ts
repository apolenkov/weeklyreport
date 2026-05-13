/**
 * UAT DOM extractor — A38-3.
 *
 * Scans .tsx source files for data-testid attributes and produces
 * tools/uat-extractor/matrix.json with the coverage status of each element.
 *
 * Run: pnpm uat:parse-dom
 * Output: tools/uat-extractor/matrix.json
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(__filename, "../../../");

// ---- Collect all data-testid values from .tsx source ----

type DOMElement = {
  testId: string;
  file: string;
  line: number;
};

function walkTsx(dir: string, results: DOMElement[]) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (["node_modules", ".next", "dist", ".git"].includes(entry)) continue;
      walkTsx(fullPath, results);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      const src = readFileSync(fullPath, "utf-8");
      const lines = src.split("\n");
      lines.forEach((line, idx) => {
        const match = line.match(/data-testid=["'{`]([^"'{`}]+)["'{`}]/);
        if (match) {
          results.push({
            testId: match[1],
            file: relative(ROOT, fullPath),
            line: idx + 1,
          });
        }
      });
    }
  }
}

// ---- Collect covered testIds from UAT-SCENARIO/*.md ----

function collectCoveredIds(scenarioDir: string): Set<string> {
  const covered = new Set<string>();
  try {
    for (const file of readdirSync(scenarioDir)) {
      if (!file.endsWith(".md")) continue;
      const content = readFileSync(join(scenarioDir, file), "utf-8");
      // Match: data-testid="..." patterns in scenario files
      const matches = content.matchAll(/data-testid=["']([^"']+)["']/g);
      for (const m of matches) covered.add(m[1]);
    }
  } catch {
    // no scenario dir yet
  }
  return covered;
}

// ---- Build matrix ----

type MatrixRow = DOMElement & { covered: boolean };

function main() {
  const elements: DOMElement[] = [];
  const webSrc = join(ROOT, "apps/web/src");
  const apiSrc = join(ROOT, "apps/api/src");

  walkTsx(webSrc, elements);
  walkTsx(apiSrc, elements);

  const scenarioDir = join(ROOT, "UAT-SCENARIO");
  const coveredIds = collectCoveredIds(scenarioDir);

  const matrix: MatrixRow[] = elements.map((el) => ({
    ...el,
    covered: coveredIds.has(el.testId),
  }));

  const total = matrix.length;
  const covered = matrix.filter((r) => r.covered).length;
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      total,
      covered,
      uncovered: total - covered,
      coveragePercent: pct,
    },
    elements: matrix,
  };

  const outPath = join(ROOT, "tools/uat-extractor/matrix.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`DOM coverage: ${covered}/${total} (${pct}%)`);
  console.log(`Written to: ${outPath}`);

  if (pct < 80) {
    console.warn(
      `[WARN] Coverage below 80% — add UAT-SCENARIO items for uncovered elements.`,
    );
  }
}

main();
