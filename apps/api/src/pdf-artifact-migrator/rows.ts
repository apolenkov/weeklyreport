import { randomUUID } from "node:crypto";

import {
  artifactPath,
  linkNoOverwrite,
  lstatMaybe,
  syncDirectory,
  type VerifiedArtifact,
  verifyArtifactFile,
} from "./artifacts.js";
import type { CompletedArtifactRow } from "./db.js";
import { anomaly, type RowVerdictResult } from "./report.js";
import {
  type JobRecord,
  probeLinkAgainstRecord,
  readRecord,
  recordBinds,
  recordPathFor,
  recordsDirFor,
  writeTransition,
} from "./state.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const DETAIL_FOREIGN = "destination-foreign";
const STATE_COMMITTED = "committed";
const STATE_INTENT = "intent";
const VERDICT_ALREADY_LINKED = "already-linked";
const VERDICT_LINKED = "linked";

type BoundRow =
  | {
      readonly ok: true;
      readonly checksum: string;
      readonly sourcePath: string;
      readonly linkPath: string;
      readonly record: JobRecord | undefined;
    }
  | { readonly ok: false; readonly report: RowVerdictResult };

// A row only reaches mutation when its jobId is a UUID (record filename and
// artifact name safety), its checksum is present, and any existing record is
// strict-schema-valid AND bound to this row's canonical paths and checksum.
const loadBoundRow = (
  root: string,
  row: CompletedArtifactRow,
): Promise<BoundRow> | BoundRow => {
  if (!UUID_PATTERN.test(row.jobId))
    return { ok: false, report: anomaly("jobid-not-uuid") };
  const checksum = row.checksum?.trim().toLowerCase();
  if (checksum === undefined || checksum === "") {
    return { ok: false, report: anomaly("checksum-absent") };
  }
  const sourcePath = artifactPath(root, `${row.jobId}.pdf`);
  const linkPath = artifactPath(root, `${row.jobId}-g1.pdf`);
  return readRecord(recordPathFor(recordsDirFor(root), row.jobId)).then(
    (prior) => {
      if (prior.kind === "corrupt") {
        return { ok: false, report: anomaly(prior.detail) };
      }
      if (
        prior.kind === "ok" &&
        !recordBinds(prior.record, row.jobId, checksum, sourcePath, linkPath)
      ) {
        return { ok: false, report: anomaly("record-mismatch") };
      }
      return {
        ok: true,
        checksum,
        sourcePath,
        linkPath,
        record: prior.kind === "ok" ? prior.record : undefined,
      };
    },
  );
};

// adoptExisting distinguishes a recovered intent (a durable record proves an
// earlier run may already have created the link before crashing) from a fresh
// intent: a link that EEXISTs under a fresh intent predates this record and is
// foreign even when it shares the source inode.
const linkAndCommit = async (
  root: string,
  base: Omit<JobRecord, "version" | "operation" | "state">,
  sourcePath: string,
  linkPath: string,
  intent: JobRecord,
  adoptExisting: boolean,
): Promise<RowVerdictResult> => {
  const linkResult = await linkNoOverwrite(sourcePath, linkPath);
  if (linkResult === "exists") {
    if (!adoptExisting) return anomaly(DETAIL_FOREIGN);
    const probe = await probeLinkAgainstRecord(linkPath, intent);
    if (probe === "mismatch") return anomaly(DETAIL_FOREIGN);
    if (probe === "absent") return anomaly("destination-vanished");
    // The link may be the crashed run's own: fsync its directory entry before
    // recording it committed.
    await syncDirectory(root);
    await writeTransition(root, { ...base, state: STATE_COMMITTED });
    return { verdict: VERDICT_ALREADY_LINKED };
  }
  await syncDirectory(root);
  await writeTransition(root, { ...base, state: STATE_COMMITTED });
  return { verdict: VERDICT_LINKED };
};

const recordBase = (
  row: CompletedArtifactRow,
  sourcePath: string,
  linkPath: string,
  dev: bigint,
  ino: bigint,
  sha256: string,
): Omit<JobRecord, "version" | "operation" | "state"> => ({
  jobId: row.jobId,
  source: {
    name: `${row.jobId}.pdf`,
    path: sourcePath,
    dev: String(dev),
    ino: String(ino),
  },
  destination: { name: `${row.jobId}-g1.pdf`, path: linkPath },
  sha256,
});

const recoverIntent = async (
  root: string,
  row: CompletedArtifactRow,
  record: JobRecord,
  sourcePath: string,
  linkPath: string,
  source: VerifiedArtifact,
): Promise<RowVerdictResult> => {
  const base = {
    jobId: row.jobId,
    source: record.source,
    destination: record.destination,
    sha256: record.sha256,
  };
  const probe = await probeLinkAgainstRecord(linkPath, record);
  if (probe === "mismatch") return anomaly("record-intent-dest-mismatch");
  if (probe === "match") {
    await syncDirectory(root);
    await writeTransition(root, { ...base, state: STATE_COMMITTED });
    return { verdict: VERDICT_LINKED };
  }
  // Dest absent: the link may be retried only while the recorded identity
  // still describes the live source — a replaced source (same checksum, new
  // inode) is not the file the crashed run intended to link.
  if (
    record.source.dev !== String(source.dev) ||
    record.source.ino !== String(source.inode)
  ) {
    return anomaly("record-intent-source-mismatch");
  }
  // Retry under the same recorded intent. A same-inode EEXIST here is
  // plausibly the crashed run's own link — adoption allowed.
  return linkAndCommit(root, base, sourcePath, linkPath, record, true);
};

export const applyRow = async (
  root: string,
  row: CompletedArtifactRow,
): Promise<RowVerdictResult> => {
  const bound = await loadBoundRow(root, row);
  if (!bound.ok) return bound.report;
  const { checksum, sourcePath, linkPath, record } = bound;

  if (record?.state === STATE_COMMITTED) {
    const probe = await probeLinkAgainstRecord(linkPath, record);
    return probe === "match"
      ? { verdict: VERDICT_ALREADY_LINKED }
      : anomaly(`record-committed-dest-${probe}`);
  }
  if (record?.state === "rollback-intent") {
    return anomaly("record-rollback-intent");
  }

  // Fresh row, rolled-back row being re-applied, or an interrupted intent:
  // the source must verify before any mutation.
  const source = await verifyArtifactFile(sourcePath, checksum);
  if (!source.ok) return anomaly(`source-${source.reason}`);

  if (record?.state === STATE_INTENT) {
    return recoverIntent(root, row, record, sourcePath, linkPath, source.file);
  }

  // Fresh or rolled-back: the destination must be absent BEFORE the intent is
  // persisted. Anything already there has no matching record — it is foreign
  // even when it hard-links the same inode, and must never gain a record that
  // would let a later run adopt or rollback-delete it.
  if ((await lstatMaybe(linkPath)) !== undefined) {
    return anomaly(DETAIL_FOREIGN);
  }

  // Durable intent BEFORE the link so a crash cannot produce an unrecorded
  // link.
  const base = recordBase(
    row,
    sourcePath,
    linkPath,
    source.file.dev,
    source.file.inode,
    source.file.sha256,
  );
  const intent: JobRecord = {
    version: 1,
    operation: randomUUID(),
    ...base,
    state: STATE_INTENT,
  };
  await writeTransition(root, { ...base, state: STATE_INTENT });
  return linkAndCommit(root, base, sourcePath, linkPath, intent, false);
};

// No record or a rolled-back one: a verifying destination is foreign rather
// than proof of migration; only an absent destination with a valid source is
// pending work.
const checkUnrecorded = async (
  checksum: string,
  sourcePath: string,
  linkPath: string,
  rolledBack: boolean,
): Promise<RowVerdictResult> => {
  const destination = await verifyArtifactFile(linkPath, checksum);
  if (destination.ok) {
    return anomaly(
      rolledBack ? "record-rolled-back-dest-present" : DETAIL_FOREIGN,
    );
  }
  if (destination.reason !== "missing") {
    return anomaly(`destination-${destination.reason}`);
  }
  const source = await verifyArtifactFile(sourcePath, checksum);
  return source.ok
    ? { verdict: "would-link" }
    : anomaly(`source-${source.reason}`);
};

export const checkRow = async (
  root: string,
  row: CompletedArtifactRow,
): Promise<RowVerdictResult> => {
  const bound = await loadBoundRow(root, row);
  if (!bound.ok) return bound.report;
  const { checksum, sourcePath, linkPath, record } = bound;

  if (record === undefined || record.state === "rolled-back") {
    return checkUnrecorded(
      checksum,
      sourcePath,
      linkPath,
      record !== undefined,
    );
  }
  if (record.state === STATE_COMMITTED) {
    const probe = await probeLinkAgainstRecord(linkPath, record);
    return probe === "match"
      ? { verdict: VERDICT_ALREADY_LINKED }
      : anomaly(`record-committed-dest-${probe}`);
  }

  // intent / rollback-intent are mid-flight states: never a success verdict.
  const probe = await probeLinkAgainstRecord(linkPath, record);
  if (probe === "mismatch") {
    return anomaly(`record-${record.state}-dest-mismatch`);
  }
  return anomaly(
    probe === "match"
      ? `record-${record.state}-uncommitted`
      : `record-${record.state}-dest-absent`,
  );
};
