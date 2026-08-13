#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { withoutLocalGitEnvironment } from "../../shared/git-environment.ts";
import type {
  ReactDoctorBaselineEntry,
  ReactDoctorDiagnosticIdentity,
} from "./react-doctor-baseline.ts";
import {
  assertReactDoctorScanComplete,
  compareReactDoctorBaseline,
  reactDoctorBaselineIsCurrent,
} from "./react-doctor-baseline.ts";

interface ReactDoctorReport {
  readonly reactDetected: boolean;
  readonly version: string;
  readonly projects: readonly {
    readonly complete: boolean;
    readonly skippedChecks: readonly string[];
  }[];
  readonly diagnostics: readonly {
    readonly id: string;
    readonly filePath: string;
    readonly rule: string;
    readonly severity: "error" | "warning";
  }[];
  readonly summary: {
    readonly errorCount: number;
    readonly warningCount: number;
  };
}

interface ReactDoctorBaseline {
  readonly schemaVersion: 1;
  readonly reactDoctorVersion: string;
  readonly diagnostics: readonly ReactDoctorBaselineEntry[];
}

const REPO_ROOT = join(import.meta.dirname, "../../..");
const BASELINE_PATH = join(import.meta.dirname, "react-doctor-baseline.json");
const BYTES_PER_KIBIBYTE = 1024;
const KIBIBYTES_PER_MEBIBYTE = 1024;
const MAX_REPORT_MEBIBYTES = 16;
const MAX_REPORT_BYTES =
  MAX_REPORT_MEBIBYTES * KIBIBYTES_PER_MEBIBYTE * BYTES_PER_KIBIBYTE;
const pnpmExecPath = process.env.npm_execpath;

if (pnpmExecPath === undefined) {
  throw new Error("npm_execpath is unset; run this gate through pnpm");
}

const launcher = (execPath: string): readonly [string, readonly string[]] =>
  /\.[cm]?js$/.test(execPath) ? [process.execPath, [execPath]] : [execPath, []];
const [command, leadingArgs] = launcher(pnpmExecPath);
const outcome = spawnSync(
  command,
  [
    ...leadingArgs,
    "--filter",
    "@customreport/web",
    "exec",
    "react-doctor",
    ".",
    "--scope",
    "full",
    "--json",
    "--json-compact",
    "--no-telemetry",
    "--no-parallel",
    "--max-duration",
    "300",
    "--blocking",
    "error",
  ],
  {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: withoutLocalGitEnvironment(process.env),
    maxBuffer: MAX_REPORT_BYTES,
  },
);

if (outcome.error !== undefined) throw outcome.error;
if (outcome.status !== 0) {
  process.stderr.write(outcome.stderr);
  throw new Error(`React Doctor exited ${outcome.status ?? "without status"}`);
}

const report = JSON.parse(outcome.stdout) as ReactDoctorReport;
const baseline = JSON.parse(
  readFileSync(BASELINE_PATH, "utf8"),
) as ReactDoctorBaseline;

if (report.summary.errorCount !== 0) {
  throw new Error(`React Doctor reported ${report.summary.errorCount} errors`);
}
assertReactDoctorScanComplete(report.reactDetected, report.projects);
if (report.version !== baseline.reactDoctorVersion) {
  throw new Error(
    `React Doctor version drift: ${baseline.reactDoctorVersion} -> ${report.version}`,
  );
}

const current: readonly ReactDoctorDiagnosticIdentity[] =
  report.diagnostics.map((diagnostic) => ({
    id: diagnostic.id,
    file: diagnostic.filePath,
    rule: diagnostic.rule,
  }));
const diff = compareReactDoctorBaseline(baseline.diagnostics, current);

if (!reactDoctorBaselineIsCurrent(diff)) {
  process.stderr.write(`${JSON.stringify(diff, null, 2)}\n`);
  throw new Error("React Doctor diagnostics differ from the reviewed baseline");
}

process.stdout.write(
  `react-doctor PASS ${report.summary.errorCount} errors, ${report.summary.warningCount} reviewed warnings\n`,
);
