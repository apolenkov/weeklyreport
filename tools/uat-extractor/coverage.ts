/**
 * UAT coverage gate — A38-3.
 *
 * Reads tools/uat-extractor/matrix.json and reports coverage statistics.
 * Enforces 100% DOM coverage unless UAT_COVERAGE_ALLOW_GAP=true (for deferred screens
 * like director-view that are intentionally not yet implemented).
 *
 * Run: pnpm uat:coverage
 * Exit codes: 0 = pass (or gap allowed), 1 = fail
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(__filename, "../../../");

type MatrixSummary = {
  generatedAt: string;
  summary: {
    total: number;
    covered: number;
    uncovered: number;
    coveragePercent: number;
  };
  elements: Array<{
    testId: string;
    file: string;
    line: number;
    covered: boolean;
  }>;
};

function main() {
  const matrixPath = join(ROOT, "tools/uat-extractor/matrix.json");
  let matrix: MatrixSummary;

  try {
    const raw = readFileSync(matrixPath, "utf-8");
    matrix = JSON.parse(raw) as MatrixSummary;
  } catch (err) {
    console.error(`[ERROR] Cannot read ${matrixPath}`);
    console.error(err);
    process.exit(1);
  }

  const { total, covered, uncovered, coveragePercent } = matrix.summary;

  console.log("\n=== UAT DOM Coverage Report ===\n");
  console.table({
    Total: total,
    Covered: covered,
    Uncovered: uncovered,
    "Coverage %": coveragePercent,
  });

  if (uncovered > 0) {
    console.log("\nUncovered elements:\n");
    const uncoveredItems = matrix.elements.filter((el) => !el.covered);
    uncoveredItems.forEach((el) => {
      console.log(`  • ${el.testId} (${el.file}:${el.line})`);
    });
  }

  const allowGap = process.env.UAT_COVERAGE_ALLOW_GAP === "true";

  if (coveragePercent < 100) {
    if (allowGap) {
      console.warn(
        `\n[WARN] Coverage ${coveragePercent}% < 100% but UAT_COVERAGE_ALLOW_GAP=true (deferred screens allowed).`,
      );
      process.exit(0);
    }
    console.error(
      `\n[ERROR] Coverage ${coveragePercent}% < 100%. Add UAT-SCENARIO items or set UAT_COVERAGE_ALLOW_GAP=true.`,
    );
    process.exit(1);
  }

  console.log("\n[SUCCESS] 100% coverage ✓\n");
  process.exit(0);
}

main();
