import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";

import { chromium } from "@playwright/test";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

import {
  evaluateAcceptanceBudget,
  measureAcceptanceSource,
} from "./budget-gate.ts";
import { waitForLoopbackPortsFree } from "./cleanup.ts";
import {
  acceptanceResultFor,
  lifecyclePathsFor,
  readJson,
  type SourceReceipt,
  type TeardownReceipt,
  writeJson,
} from "./lifecycle.ts";

interface ReporterOptions {
  readonly apiPort: number;
  readonly commandKind: "combined" | "route-health" | "smoke";
  readonly repoRoot: string;
  readonly resultsRoot: string;
  readonly webPort: number;
  readonly webDistDir: string;
}

const browserVersion = (): string => {
  try {
    return execFileSync(chromium.executablePath(), ["--version"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "UNKNOWN";
  }
};

export default class AcceptanceReporter implements Reporter {
  private readonly counts = {
    failed: 0,
    interrupted: 0,
    passed: 0,
    skipped: 0,
    timedOut: 0,
  };

  private total = 0;

  constructor(private readonly options: ReporterOptions) {}

  printsToStdio(): boolean {
    return false;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.total = suite.allTests().length;
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    this.counts[result.status] += 1;
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult["status"] }> {
    if (process.argv.includes("--list")) return {};

    const paths = lifecyclePathsFor(this.options.resultsRoot);
    const [source, teardown, listenersFree] = await Promise.all([
      readJson<SourceReceipt>(paths.source).catch(() => undefined),
      readJson<TeardownReceipt>(paths.teardown).catch(() => undefined),
      waitForLoopbackPortsFree([this.options.apiPort, this.options.webPort]),
    ]);
    const ownedFilesRemoved = listenersFree
      ? await rm(this.options.webDistDir, { force: true, recursive: true })
          .then(() => true)
          .catch(() => false)
      : false;
    const teardownStartedAt = teardown?.startedAt
      ? Date.parse(teardown.startedAt)
      : Number.NaN;
    const teardownDurationMs = Number.isFinite(teardownStartedAt)
      ? Math.max(0, Date.now() - teardownStartedAt)
      : Number.POSITIVE_INFINITY;
    const sourceMeasurement = measureAcceptanceSource(this.options.repoRoot);
    const budget = evaluateAcceptanceBudget({
      ...sourceMeasurement,
      commandKind: this.options.commandKind,
      durationMs: result.duration,
      teardownDurationMs,
    });
    const verdict = acceptanceResultFor({
      budgetValid: budget.status === "PASS",
      listenersFree,
      ownedFilesRemoved,
      playwrightStatus: result.status,
      setupStatus: source?.setupStatus ?? "MISSING",
      teardownValid:
        teardown?.cleanupStatus === "PASS" &&
        teardown.clients === "TRANSIENT_CLIENTS_CLOSED" &&
        teardown.containers === "NONE_CREATED" &&
        teardown.databaseState === "DETERMINISTIC_FULL_SEED" &&
        teardown.redisState === "RESERVED_DB_15_EMPTY" &&
        teardown.sourceUnchanged &&
        teardown.volumes === "NONE_CREATED",
    });
    await writeJson(paths.result, {
      schemaVersion: 1,
      source: source
        ? { sha: source.sha, tree: source.tree }
        : { sha: "UNKNOWN", tree: "UNKNOWN" },
      browser: browserVersion(),
      budget: {
        ...budget,
        measurements: {
          commandDurationMs: result.duration,
          fileCount: sourceMeasurement.fileCount,
          lineCount: sourceMeasurement.lineCount,
          teardownDurationMs,
        },
      },
      cleanup: {
        listenersFree,
        ownedFilesRemoved,
        status: verdict.cleanupStatus,
        teardown: teardown ?? null,
      },
      commandKind: this.options.commandKind,
      durationMs: result.duration,
      finishedAt: new Date().toISOString(),
      overallStatus: verdict.overallStatus,
      playwrightStatus: result.status,
      startedAt: result.startTime.toISOString(),
      tests: { ...this.counts, total: this.total },
    });
    return verdict.overallStatus === "PASS" ? {} : { status: "failed" };
  }
}
