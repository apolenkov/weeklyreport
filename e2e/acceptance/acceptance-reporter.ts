import { execFileSync } from "node:child_process";

import { chromium } from "@playwright/test";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

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
  readonly commandKind: "full" | "route-health" | "smoke";
  readonly resultsRoot: string;
  readonly webPort: number;
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
    const paths = lifecyclePathsFor(this.options.resultsRoot);
    const [source, teardown, listenersFree] = await Promise.all([
      readJson<SourceReceipt>(paths.source).catch(() => undefined),
      readJson<TeardownReceipt>(paths.teardown).catch(() => undefined),
      waitForLoopbackPortsFree([this.options.apiPort, this.options.webPort]),
    ]);
    const verdict = acceptanceResultFor({
      listenersFree,
      playwrightStatus: result.status,
      setupStatus: source?.setupStatus ?? "MISSING",
      teardownValid:
        teardown?.clients === "NO_PERSISTENT_CLIENTS" &&
        teardown.sourceUnchanged,
    });
    await writeJson(paths.result, {
      schemaVersion: 1,
      source: source
        ? { sha: source.sha, tree: source.tree }
        : { sha: "UNKNOWN", tree: "UNKNOWN" },
      browser: browserVersion(),
      cleanup: {
        listenersFree,
        status: verdict.cleanupStatus,
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
