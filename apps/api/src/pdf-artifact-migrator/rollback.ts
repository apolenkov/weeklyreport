import { syncDirectory, unlinkFile } from "./artifacts.js";
import {
  anomaly,
  type Emit,
  emptySummary,
  EXIT_OK,
  EXIT_UNRESOLVED,
  type RowVerdictResult,
  type RunOutcome,
  summarize,
} from "./report.js";
import {
  type JobRecord,
  type ListedRecords,
  listRecords,
  MigrationStateError,
  probeLinkAgainstRecord,
  recordBindsCanonical,
  recordsDirFor,
  writeTransition,
} from "./state.js";

const STATE_ROLLED_BACK = "rolled-back";

const transitionTo = async (
  root: string,
  record: JobRecord,
  state: JobRecord["state"],
): Promise<void> =>
  writeTransition(root, {
    jobId: record.jobId,
    source: record.source,
    destination: record.destination,
    sha256: record.sha256,
    state,
  });

// The destination is unlinked only after the record still binds to this root
// and the live file still matches the recorded dev+inode+sha256. A crash
// between rollback-intent and rolled-back is recovered by re-running the same
// checks: absent destination -> finalize rolled-back; matching destination ->
// retry unlink; mismatched destination -> anomaly, nothing is deleted.
const rollbackEntry = async (
  root: string,
  record: JobRecord,
): Promise<RowVerdictResult> => {
  if (!recordBindsCanonical(record, root)) return anomaly("record-mismatch");
  // An intent is unresolved mid-flight apply state: apply owns its recovery
  // (retry/finalize/report), rollback only ever unlinks committed links.
  if (record.state === "intent") {
    return anomaly("record-intent-unresolved");
  }

  const probe = await probeLinkAgainstRecord(record.destination.path, record);
  if (record.state === STATE_ROLLED_BACK) {
    return probe === "absent"
      ? { verdict: "already-absent" }
      : anomaly("record-rolled-back-dest-present");
  }
  if (probe === "mismatch") {
    return anomaly(`record-${record.state}-dest-mismatch`);
  }
  if (probe === "absent") {
    // Link already gone (never created, or a crashed rollback finished the
    // unlink but not the record): finalize idempotently.
    await transitionTo(root, record, STATE_ROLLED_BACK);
    return { verdict: "already-absent" };
  }

  // Destination verified against the record: durable rollback-intent, then
  // unlink, fsync the artifact directory, durable rolled-back.
  if (record.state !== "rollback-intent") {
    await transitionTo(root, record, "rollback-intent");
  }
  await unlinkFile(record.destination.path);
  await syncDirectory(root);
  await transitionTo(root, record, STATE_ROLLED_BACK);
  return { verdict: "removed" };
};

const rollbackRecords = async (
  root: string,
  records: ListedRecords,
  emit: Emit,
): Promise<RowVerdictResult[]> => {
  const reports: RowVerdictResult[] = [];
  for (const stray of records.strays) {
    const report = anomaly(`record-stray:${stray}`);
    reports.push(report);
    emit({ type: "row", jobId: `records:${stray}`, ...report });
  }
  for (const { name, read } of records.entries) {
    const jobId = name.slice(0, -".json".length);
    if (read.kind !== "ok") {
      const report = anomaly(
        read.kind === "corrupt" ? read.detail : "record-vanished",
      );
      reports.push(report);
      emit({ type: "row", jobId, ...report });
      continue;
    }
    const report = await rollbackEntry(root, read.record).catch(
      (error: unknown) =>
        anomaly(error instanceof Error ? error.message : String(error)),
    );
    reports.push(report);
    emit({ type: "row", jobId: read.record.jobId, ...report });
  }
  return reports;
};

export const runRollback = async (
  root: string,
  emit: Emit,
): Promise<RunOutcome> => {
  const listed = await listRecords(recordsDirFor(root)).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!listed.ok) {
    if (!(listed.error instanceof MigrationStateError)) throw listed.error;
    const report = anomaly(listed.error.message);
    emit({ type: "row", jobId: "records", ...report });
    const summary = summarize("rollback", [report]);
    emit({ type: "summary", summary });
    return { exitCode: EXIT_UNRESOLVED, summary };
  }
  if (listed.value === undefined) {
    emit({ type: "info", message: "records-absent" });
    const summary = emptySummary("rollback");
    emit({ type: "summary", summary });
    return { exitCode: EXIT_OK, summary };
  }

  const reports = await rollbackRecords(root, listed.value, emit);
  const summary = summarize("rollback", reports);
  emit({ type: "summary", summary });
  return {
    exitCode: summary.anomalies === 0 ? EXIT_OK : EXIT_UNRESOLVED,
    summary,
  };
};
