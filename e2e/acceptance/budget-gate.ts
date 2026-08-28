import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { sourceIdentityFor } from "./lifecycle.ts";

const COMBINED_DURATION_MINUTES = 15;
const GIT_EXECUTABLE = "/usr/bin/git";
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
  readonly sha: string;
  readonly teardownDurationMs: number;
  readonly tree: string;
}

interface ExpectedSourceIdentity {
  readonly sha: string;
  readonly tree: string;
}

const SHA_PATTERN = /^[0-9a-f]{40}$/u;

const generatedPath = (relativePath: string): boolean =>
  relativePath.startsWith("e2e/acceptance/.results/");

export function acceptanceSourceFiles(repoRoot: string): readonly string[] {
  const output = execFileSync(
    GIT_EXECUTABLE,
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

const nonnegativeNumber = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`acceptance receipt has an invalid ${label}`);
  }
  return value;
};

const nonnegativeInteger = (value: unknown, label: string): number => {
  const parsed = nonnegativeNumber(value, label);
  if (!Number.isInteger(parsed)) {
    throw new TypeError(`acceptance receipt has a non-integer ${label}`);
  }
  return parsed;
};

const sourceIdentityFrom = (
  receipt: Record<string, unknown>,
  expectedSource: ExpectedSourceIdentity | undefined,
): ExpectedSourceIdentity => {
  const source = recordOf(receipt.source);
  const sha = source.sha;
  const tree = source.tree;
  if (
    typeof sha !== "string" ||
    typeof tree !== "string" ||
    !SHA_PATTERN.test(sha) ||
    !SHA_PATTERN.test(tree)
  ) {
    throw new TypeError("acceptance receipt has an invalid source SHA/tree");
  }
  if (
    expectedSource !== undefined &&
    (sha !== expectedSource.sha || tree !== expectedSource.tree)
  ) {
    throw new Error(
      "acceptance receipt source does not match current SHA/tree",
    );
  }
  return { sha, tree };
};

const commandKindFrom = (
  value: unknown,
): AcceptanceRuntimeReceipt["commandKind"] => {
  if (value !== "combined" && value !== "route-health" && value !== "smoke") {
    throw new Error("acceptance receipt has an invalid commandKind");
  }
  return value;
};

const assertTerminalPass = (
  receipt: Record<string, unknown>,
  cleanup: Record<string, unknown>,
  teardown: Record<string, unknown>,
  budget: Record<string, unknown>,
): void => {
  const violations = budget.violations;
  const passing =
    receipt.overallStatus === "PASS" &&
    receipt.playwrightStatus === "passed" &&
    cleanup.status === "PASS" &&
    cleanup.listenersFree === true &&
    cleanup.ownedFilesRemoved === true &&
    teardown.cleanupStatus === "PASS" &&
    teardown.clients === "TRANSIENT_CLIENTS_CLOSED" &&
    teardown.containers === "NONE_CREATED" &&
    teardown.databaseState === "DETERMINISTIC_FULL_SEED" &&
    teardown.redisState === "RESERVED_DB_15_EMPTY" &&
    teardown.sourceUnchanged === true &&
    teardown.volumes === "NONE_CREATED" &&
    budget.status === "PASS" &&
    Array.isArray(violations) &&
    violations.length === 0;
  if (!passing) {
    throw new Error("acceptance receipt is not a terminal passing result");
  }
};

const assertPassingTestCounts = (tests: Record<string, unknown>): void => {
  const total = nonnegativeInteger(tests.total, "test total");
  const passed = nonnegativeInteger(tests.passed, "passed test count");
  const failed = nonnegativeInteger(tests.failed, "failed test count");
  const interrupted = nonnegativeInteger(
    tests.interrupted,
    "interrupted test count",
  );
  const skipped = nonnegativeInteger(tests.skipped, "skipped test count");
  const timedOut = nonnegativeInteger(tests.timedOut, "timed-out test count");
  if (
    total === 0 ||
    passed !== total ||
    failed !== 0 ||
    interrupted !== 0 ||
    skipped !== 0 ||
    timedOut !== 0
  ) {
    throw new Error("acceptance receipt test totals are not fully passing");
  }
};

export function parseAcceptanceRuntimeReceipt(
  value: unknown,
  expectedSource?: ExpectedSourceIdentity,
): AcceptanceRuntimeReceipt {
  const receipt = recordOf(value);
  if (receipt.schemaVersion !== 1) {
    throw new Error("acceptance receipt has an unsupported schemaVersion");
  }
  const source = sourceIdentityFrom(receipt, expectedSource);
  const cleanup = recordOf(receipt.cleanup);
  const teardown = recordOf(cleanup.teardown);
  const budget = recordOf(receipt.budget);
  const measurements = recordOf(budget.measurements);
  const tests = recordOf(receipt.tests);
  const commandKind = commandKindFrom(receipt.commandKind);
  const durationMs = nonnegativeNumber(receipt.durationMs, "durationMs");
  const commandDurationMs = nonnegativeNumber(
    measurements.commandDurationMs,
    "command duration",
  );
  const teardownDurationMs = nonnegativeNumber(
    measurements.teardownDurationMs,
    "teardown duration",
  );
  if (durationMs !== commandDurationMs) {
    throw new Error("acceptance receipt duration measurements disagree");
  }
  nonnegativeInteger(measurements.fileCount, "file count");
  nonnegativeInteger(measurements.lineCount, "line count");
  assertTerminalPass(receipt, cleanup, teardown, budget);
  assertPassingTestCounts(tests);
  return {
    commandKind,
    durationMs,
    sha: source.sha,
    teardownDurationMs,
    tree: source.tree,
  };
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
    status: violations.length > 0 ? "FAIL" : "PASS",
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
          sourceIdentityFor(repoRoot),
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
