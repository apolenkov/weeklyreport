import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

const COMBINED_DURATION_MINUTES = 15;
const MINUTE_MS = 60_000;
const SMOKE_DURATION_MINUTES = 10;

export const ACCEPTANCE_BUDGET = {
  combinedDurationMs: COMBINED_DURATION_MINUTES * MINUTE_MS,
  fileCount: 25,
  lineCount: 4000,
  smokeDurationMs: SMOKE_DURATION_MINUTES * MINUTE_MS,
  teardownDurationMs: 2 * MINUTE_MS,
} as const;

export interface AcceptanceBudgetMeasurement {
  readonly commandKind?: "combined" | "route-health" | "smoke";
  readonly durationMs?: number;
  readonly fileCount: number;
  readonly lineCount: number;
  readonly teardownDurationMs?: number;
}

export interface AcceptanceBudgetResult {
  readonly status: "FAIL" | "PASS";
  readonly violations: readonly string[];
}

interface AcceptanceRuntimeReceipt {
  readonly commandKind: "combined" | "route-health" | "smoke";
  readonly durationMs: number;
  readonly teardownDurationMs: number;
}

const generatedPath = (relativePath: string): boolean =>
  relativePath.startsWith("e2e/acceptance/.results/");

export function acceptanceSourceFiles(repoRoot: string): readonly string[] {
  const output = execFileSync(
    "/usr/bin/git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "e2e/acceptance",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return output
    .split("\0")
    .filter(
      (entry) =>
        entry !== "" &&
        !generatedPath(entry) &&
        existsSync(path.join(repoRoot, entry)),
    )
    .sort((left, right) => left.localeCompare(right));
}

const lineCountFor = (contents: string): number =>
  contents === ""
    ? 0
    : contents.split("\n").length - Number(contents.endsWith("\n"));

export function measureAcceptanceSource(
  repoRoot: string,
): AcceptanceBudgetMeasurement {
  const files = acceptanceSourceFiles(repoRoot);
  return {
    fileCount: files.length,
    lineCount: files.reduce(
      (total, file) =>
        total + lineCountFor(readFileSync(path.join(repoRoot, file), "utf8")),
      0,
    ),
  };
}

const recordOf = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("acceptance receipt must be a JSON object");
  }
  return value as Record<string, unknown>;
};

export function parseAcceptanceRuntimeReceipt(
  value: unknown,
): AcceptanceRuntimeReceipt {
  const receipt = recordOf(value);
  const budget = recordOf(receipt.budget);
  const measurements = recordOf(budget.measurements);
  const commandKind = receipt.commandKind;
  const durationMs = receipt.durationMs;
  const teardownDurationMs = measurements.teardownDurationMs;
  if (
    commandKind !== "combined" &&
    commandKind !== "route-health" &&
    commandKind !== "smoke"
  ) {
    throw new Error("acceptance receipt has an invalid commandKind");
  }
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    throw new TypeError("acceptance receipt has an invalid durationMs");
  }
  if (
    typeof teardownDurationMs !== "number" ||
    !Number.isFinite(teardownDurationMs)
  ) {
    throw new TypeError("acceptance receipt has an invalid teardown duration");
  }
  return { commandKind, durationMs, teardownDurationMs };
}

export function evaluateAcceptanceBudget(
  measurement: AcceptanceBudgetMeasurement,
): AcceptanceBudgetResult {
  const violations: string[] = [];
  if (measurement.fileCount > ACCEPTANCE_BUDGET.fileCount) {
    violations.push(
      `acceptance file count ${measurement.fileCount} exceeds ${ACCEPTANCE_BUDGET.fileCount}`,
    );
  }
  if (measurement.lineCount > ACCEPTANCE_BUDGET.lineCount) {
    violations.push(
      `acceptance line count ${measurement.lineCount} exceeds ${ACCEPTANCE_BUDGET.lineCount}`,
    );
  }
  if (measurement.durationMs !== undefined) {
    const durationLimit =
      measurement.commandKind === "smoke"
        ? ACCEPTANCE_BUDGET.smokeDurationMs
        : ACCEPTANCE_BUDGET.combinedDurationMs;
    if (measurement.durationMs > durationLimit) {
      violations.push(
        `acceptance ${measurement.commandKind ?? "unknown"} duration ${measurement.durationMs}ms exceeds ${durationLimit}ms`,
      );
    }
  }
  if (
    measurement.teardownDurationMs !== undefined &&
    measurement.teardownDurationMs > ACCEPTANCE_BUDGET.teardownDurationMs
  ) {
    violations.push(
      `acceptance teardown duration ${measurement.teardownDurationMs}ms exceeds ${ACCEPTANCE_BUDGET.teardownDurationMs}ms`,
    );
  }
  return {
    status: violations.length === 0 ? "PASS" : "FAIL",
    violations,
  };
}

const main = (): void => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const receiptFlag = process.argv.indexOf("--receipt");
  const receiptArgument =
    receiptFlag === -1 ? undefined : process.argv[receiptFlag + 1];
  if (receiptFlag !== -1 && !receiptArgument) {
    throw new Error("--receipt requires a file path");
  }
  const receiptPath =
    receiptArgument ??
    path.join(import.meta.dirname, ".results", "acceptance-result.json");
  const requireReceipt = process.argv.includes("--require-receipt");
  const inspectReceipt = receiptFlag !== -1 || requireReceipt;
  const sourceMeasurement = measureAcceptanceSource(repoRoot);
  const runtimeMeasurement =
    inspectReceipt && existsSync(receiptPath)
      ? parseAcceptanceRuntimeReceipt(
          JSON.parse(readFileSync(receiptPath, "utf8")) as unknown,
        )
      : undefined;
  if (requireReceipt && runtimeMeasurement === undefined) {
    process.stderr.write(`acceptance receipt missing: ${receiptPath}\n`);
    process.exitCode = 1;
    return;
  }
  const measurement = { ...sourceMeasurement, ...runtimeMeasurement };
  const result = evaluateAcceptanceBudget(measurement);
  process.stdout.write(
    `acceptance budget ${result.status} — ${measurement.fileCount}/${ACCEPTANCE_BUDGET.fileCount} files, ${measurement.lineCount}/${ACCEPTANCE_BUDGET.lineCount} lines\n`,
  );
  result.violations.forEach((violation) =>
    process.stderr.write(`acceptance budget violation: ${violation}\n`),
  );
  if (result.status === "FAIL") process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main();
}
