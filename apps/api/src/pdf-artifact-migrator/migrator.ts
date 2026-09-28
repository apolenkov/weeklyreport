import { lstat } from "node:fs/promises";

import { confirmationToken, type MigratorConfig } from "./config.js";
import type { ArtifactRowSource, CompletedArtifactRow } from "./db.js";
import {
  anomaly,
  type Emit,
  emptySummary,
  EXIT_OK,
  EXIT_REFUSED,
  EXIT_UNRESOLVED,
  type RowVerdictResult,
  type RunOutcome,
  summarize,
  toAnomaly,
  unresolved,
} from "./report.js";
import { runRollback } from "./rollback.js";
import { applyRow, checkRow } from "./rows.js";
import {
  acquireRunLock,
  type ListedRecords,
  listRecords,
  MigrationStateError,
  type RecordRead,
  recordsDirFor,
} from "./state.js";

export type {
  MigratorEvent,
  MigratorMode,
  RowVerdict,
  RunOutcome,
  RunSummary,
} from "./report.js";
export { EXIT_OK, EXIT_REFUSED, EXIT_UNRESOLVED } from "./report.js";

export interface MigratorDeps {
  readonly openSource?: () => Promise<ArtifactRowSource>;
}

// Files inside .migration/records that are not job records (a crashed staging
// temp, foreign content) mean the state directory is not clean — reported,
// never silently ignored or deleted.
const strayAnomalies = (
  strays: readonly string[],
  emit: Emit,
): RowVerdictResult[] =>
  strays.map((name) => {
    const report = anomaly(`record-stray:${name}`);
    emit({ type: "row", jobId: `records:${name}`, ...report });
    return report;
  });

const unselectedAudit = (read: RecordRead): RowVerdictResult | undefined => {
  if (read.kind === "corrupt") return anomaly(read.detail);
  if (read.kind === "absent") return anomaly("record-vanished");
  return read.record.state === "intent" ||
    read.record.state === "rollback-intent"
    ? anomaly(`record-${read.record.state}-uncommitted`)
    : undefined;
};

// A record is authoritative for its job even when that job is not in the
// current SELECT: check cannot pass while any record is corrupt or still
// mid-flight, because the next apply/rollback would inherit that state.
const auditUnselectedRecords = (
  listed: ListedRecords | undefined,
  selected: ReadonlySet<string>,
  emit: Emit,
): RowVerdictResult[] => {
  const reports: RowVerdictResult[] = [];
  for (const { name, read } of listed?.entries ?? []) {
    const jobId = name.slice(0, -".json".length);
    if (selected.has(jobId)) continue; // audited per-row by checkRow
    const report = unselectedAudit(read);
    if (report !== undefined) {
      reports.push(report);
      emit({ type: "row", jobId, ...report });
    }
  }
  return reports;
};

const refuseStart = (
  config: MigratorConfig,
  emit: Emit,
  message: string,
): RunOutcome => {
  emit({ type: "refusal", message });
  const summary = emptySummary(config.mode);
  emit({ type: "summary", summary });
  return { exitCode: EXIT_REFUSED, summary };
};

const runRowModes = async (
  config: MigratorConfig,
  root: string,
  deps: MigratorDeps,
  emit: Emit,
): Promise<RunOutcome> => {
  const listed = await listRecords(recordsDirFor(root)).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!listed.ok) {
    const message =
      listed.error instanceof MigrationStateError
        ? listed.error.message
        : `records listing failed: ${String(listed.error)}`;
    return refuseStart(config, emit, message);
  }
  const reports: RowVerdictResult[] = strayAnomalies(
    listed.value?.strays ?? [],
    emit,
  );

  if (deps.openSource === undefined) {
    throw new Error("runMigrator requires openSource for check/apply modes");
  }
  const source = await deps.openSource();
  const rows: CompletedArtifactRow[] = await source
    .listRows()
    .finally(() => source.close());

  if (config.mode === "check") {
    reports.push(
      ...auditUnselectedRecords(
        listed.value,
        new Set(rows.map((row) => row.jobId)),
        emit,
      ),
    );
  }

  const apply = config.mode === "apply";
  for (const row of rows) {
    const report = await (
      apply ? applyRow(root, row) : checkRow(root, row)
    ).catch(toAnomaly);
    reports.push(report);
    emit({ type: "row", jobId: row.jobId, ...report });
  }
  const summary = summarize(config.mode, reports);
  emit({ type: "summary", summary });
  return {
    exitCode: unresolved(config.mode, summary) ? EXIT_UNRESOLVED : EXIT_OK,
    summary,
  };
};

export const runMigrator = async (
  config: MigratorConfig,
  deps: MigratorDeps,
  emit: Emit,
): Promise<RunOutcome> => {
  if (
    config.mode !== "check" &&
    config.confirmation !== confirmationToken(config.target)
  ) {
    return refuseStart(
      config,
      emit,
      `refusing ${config.mode}: set ` +
        `PDF_ARTIFACT_MIGRATOR_CONFIRM=${confirmationToken(config.target)}`,
    );
  }

  const root = config.artifactRoot;
  const rootStats = await lstat(root).catch(() => undefined);
  if (!rootStats?.isDirectory()) {
    return refuseStart(
      config,
      emit,
      `artifact root is not an existing directory: ${root}`,
    );
  }

  const acquired = await acquireRunLock(root).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!acquired.ok) {
    const message =
      acquired.error instanceof MigrationStateError
        ? acquired.error.message
        : `migration lock acquisition failed: ${String(acquired.error)}`;
    return refuseStart(config, emit, message);
  }
  const lock = acquired.value;

  try {
    return config.mode === "rollback"
      ? await runRollback(root, emit)
      : await runRowModes(config, root, deps, emit);
  } finally {
    await lock.release();
  }
};
