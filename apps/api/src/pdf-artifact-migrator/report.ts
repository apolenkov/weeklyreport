import type { MigratorConfig } from "./config.js";

export const EXIT_OK = 0;
export const EXIT_UNRESOLVED = 1;
export const EXIT_REFUSED = 2;

export type MigratorMode = MigratorConfig["mode"];

export type RowVerdict =
  | "already-linked"
  | "would-link"
  | "linked"
  | "removed"
  | "already-absent"
  | "skipped-anomaly";

export type MigratorEvent =
  | {
      readonly type: "row";
      readonly jobId: string;
      readonly verdict: RowVerdict;
      readonly detail?: string;
    }
  | { readonly type: "info"; readonly message: string }
  | { readonly type: "refusal"; readonly message: string }
  | { readonly type: "summary"; readonly summary: RunSummary };

export interface RunSummary {
  readonly mode: MigratorMode;
  readonly rows: number;
  readonly linked: number;
  readonly alreadyLinked: number;
  readonly pending: number;
  readonly removed: number;
  readonly anomalies: number;
}

export interface RunOutcome {
  readonly exitCode: number;
  readonly summary: RunSummary;
}

export type Emit = (event: MigratorEvent) => void;

export interface RowVerdictResult {
  readonly verdict: RowVerdict;
  readonly detail?: string;
}

export const anomaly = (detail: string): RowVerdictResult => ({
  verdict: "skipped-anomaly",
  detail,
});

export const toAnomaly = (error: unknown): RowVerdictResult =>
  anomaly(`error:${error instanceof Error ? error.message : String(error)}`);

export const emptySummary = (mode: MigratorMode): RunSummary => ({
  mode,
  rows: 0,
  linked: 0,
  alreadyLinked: 0,
  pending: 0,
  removed: 0,
  anomalies: 0,
});

export const summarize = (
  mode: MigratorMode,
  reports: RowVerdictResult[],
): RunSummary => ({
  mode,
  rows: reports.length,
  linked: reports.filter((r) => r.verdict === "linked").length,
  alreadyLinked: reports.filter((r) => r.verdict === "already-linked").length,
  pending: reports.filter((r) => r.verdict === "would-link").length,
  removed: reports.filter((r) => r.verdict === "removed").length,
  anomalies: reports.filter((r) => r.verdict === "skipped-anomaly").length,
});

export const unresolved = (mode: MigratorMode, summary: RunSummary): boolean =>
  summary.anomalies > 0 || (mode === "check" && summary.pending > 0);
