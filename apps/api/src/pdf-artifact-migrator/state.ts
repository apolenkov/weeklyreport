import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";

import {
  artifactPath,
  lstatMaybe,
  syncDirectory,
  verifyArtifactFile,
} from "./artifacts.js";

// Migration state lives under <artifactRoot>/.migration/: an exclusive run
// lock directory plus one JSON record per job under records/. The lock is a
// mkdir — atomic on POSIX — so two migrator processes cannot interleave
// mutations. A crash leaves the lock directory behind; it is never reclaimed
// automatically (no PID/age checks): an operator confirms quiescence, removes
// the empty lock directory, and reruns — records drive idempotent recovery.
export const MIGRATION_DIR_NAME = ".migration";
const LOCK_DIR_NAME = "lock";
const RECORDS_DIR_NAME = "records";
const RECORD_SUFFIX = ".json";
const TEMP_SUFFIX = ".tmp";
const STATE_VERSION = 1;
const FILE_MODE = 0o600;

export type RecordState =
  "intent" | "committed" | "rollback-intent" | "rolled-back";

const RECORD_STATES: ReadonlySet<string> = new Set([
  "intent",
  "committed",
  "rollback-intent",
  "rolled-back",
]);

export interface JobRecord {
  readonly version: typeof STATE_VERSION;
  /** UUID of the operation that wrote this state transition. */
  readonly operation: string;
  readonly jobId: string;
  /** dev/ino are strings: inode numbers can exceed 2^53. */
  readonly source: {
    readonly name: string;
    readonly path: string;
    readonly dev: string;
    readonly ino: string;
  };
  readonly destination: {
    readonly name: string;
    readonly path: string;
  };
  readonly sha256: string;
  readonly state: RecordState;
}

export type RecordRead =
  | { readonly kind: "absent" }
  | { readonly kind: "ok"; readonly record: JobRecord }
  | { readonly kind: "corrupt"; readonly detail: string };

export class MigrationStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationStateError";
  }
}

export class MigrationLockHeldError extends MigrationStateError {
  constructor(lockPath: string) {
    super(
      `migration lock is held: ${lockPath} — quiesce migrators, remove the ` +
        "empty lock directory only after confirming no run is active, then rerun",
    );
    this.name = "MigrationLockHeldError";
  }
}

const isFsError = (error: unknown, code: string): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === code;

export const migrationDirFor = (root: string): string =>
  join(root, MIGRATION_DIR_NAME);

export const recordsDirFor = (root: string): string =>
  join(migrationDirFor(root), RECORDS_DIR_NAME);

export const recordPathFor = (recordsDir: string, jobId: string): string =>
  join(recordsDir, `${jobId}${RECORD_SUFFIX}`);

const ensureRealDirectory = async (path: string): Promise<void> => {
  await mkdir(path).catch((error: unknown) => {
    if (!isFsError(error, "EEXIST")) throw error;
  });
  const stats = await lstat(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new MigrationStateError(
      `migration state directory is not a real directory: ${path}`,
    );
  }
};

export interface RunLock {
  readonly release: () => Promise<void>;
}

export const acquireRunLock = async (root: string): Promise<RunLock> => {
  const migrationDir = migrationDirFor(root);
  await ensureRealDirectory(migrationDir);
  const lockPath = join(migrationDir, LOCK_DIR_NAME);
  try {
    await mkdir(lockPath);
  } catch (error) {
    if (isFsError(error, "EEXIST")) throw new MigrationLockHeldError(lockPath);
    throw error;
  }
  return {
    release: async () => {
      // rmdir removes only an empty lock directory; a lock with foreign
      // content is left for the operator rather than force-cleaned.
      await rmdir(lockPath).catch(() => undefined);
      // Pure check runs leave no records: drop the state dir again when empty.
      await rmdir(migrationDir).catch(() => undefined);
    },
  };
};

// Both levels of the state hierarchy are fsynced through their parents so a
// crash cannot lose the records directory after a link already exists.
export const ensureRecordsDir = async (root: string): Promise<string> => {
  const migrationDir = migrationDirFor(root);
  await ensureRealDirectory(migrationDir);
  await syncDirectory(root);
  const recordsDir = recordsDirFor(root);
  await ensureRealDirectory(recordsDir);
  await syncDirectory(migrationDir);
  return recordsDir;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const isStringField = (value: unknown): value is string =>
  typeof value === "string" && value !== "";

const isDecimalField = (value: unknown): value is string =>
  typeof value === "string" && /^\d+$/u.test(value);

const hasFields = (
  value: unknown,
  keys: readonly string[],
  test: (field: unknown) => boolean,
): boolean =>
  typeof value === "object" &&
  value !== null &&
  keys.every((key) => test((value as Record<string, unknown>)[key]));

const isJobRecord = (value: unknown): value is JobRecord => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const operation = record.operation;
  const jobId = record.jobId;
  const state = record.state;
  return (
    record.version === STATE_VERSION &&
    typeof operation === "string" &&
    UUID_PATTERN.test(operation) &&
    typeof jobId === "string" &&
    UUID_PATTERN.test(jobId) &&
    hasFields(record.source, ["name", "path"], isStringField) &&
    hasFields(record.source, ["dev", "ino"], isDecimalField) &&
    hasFields(record.destination, ["name", "path"], isStringField) &&
    isStringField(record.sha256) &&
    typeof state === "string" &&
    RECORD_STATES.has(state)
  );
};

export const readRecord = async (recordPath: string): Promise<RecordRead> => {
  const opened = await open(
    recordPath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK,
  ).then(
    (handle) => ({ ok: true as const, handle }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!opened.ok) {
    if (isFsError(opened.error, "ENOENT")) return { kind: "absent" };
    if (isFsError(opened.error, "ELOOP")) {
      return { kind: "corrupt", detail: "record-symlink" };
    }
    return { kind: "corrupt", detail: "record-unreadable" };
  }
  const { handle } = opened;
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      return { kind: "corrupt", detail: "record-not-regular" };
    }
    const text = await handle.readFile("utf8");
    if (!text.endsWith("\n") || text.indexOf("\n") !== text.length - 1) {
      return { kind: "corrupt", detail: "record-truncated-or-multiline" };
    }
    try {
      const parsed: unknown = JSON.parse(text.slice(0, -1));
      if (isJobRecord(parsed)) {
        return { kind: "ok", record: parsed };
      }
      return { kind: "corrupt", detail: "record-schema" };
    } catch {
      return { kind: "corrupt", detail: "record-malformed-json" };
    }
  } finally {
    await handle.close();
  }
};

// A record transition never mutates an existing file: the full next state is
// staged in a uniquely named temp file (O_EXCL — never truncated), fsynced,
// then atomically renamed over the record path, and the records directory is
// fsynced. A crash leaves the old record or a stray temp file — never a
// partial line that could hide ownership from a later run.
export const writeRecord = async (
  recordsDir: string,
  record: JobRecord,
): Promise<void> => {
  const tempPath = join(recordsDir, `${randomUUID()}${TEMP_SUFFIX}`);
  const recordPath = recordPathFor(recordsDir, record.jobId);
  const handle = await open(
    tempPath,
    fsConstants.O_WRONLY |
      fsConstants.O_CREAT |
      fsConstants.O_EXCL |
      fsConstants.O_NOFOLLOW,
    FILE_MODE,
  );
  try {
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tempPath, recordPath);
    await syncDirectory(recordsDir);
  } catch (error) {
    // The temp file was created by this call (O_EXCL), so it is ours to clean.
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
};

// A destination link is owned by a record only when it is a regular
// non-symlink file sharing the recorded source dev+inode (a hard link shares
// the inode) and content. Anything else at that path — including a
// coincidental hard link without a matching record — is foreign and is never
// removed.
export type LinkProbe = "match" | "absent" | "mismatch";

export const probeLinkAgainstRecord = async (
  linkPath: string,
  record: JobRecord,
): Promise<LinkProbe> => {
  const stats = await lstatMaybe(linkPath);
  if (stats === undefined) return "absent";
  if (stats.isSymbolicLink() || !stats.isFile()) return "mismatch";
  if (
    String(stats.ino) !== record.source.ino ||
    String(stats.dev) !== record.source.dev
  ) {
    return "mismatch";
  }
  const verified = await verifyArtifactFile(linkPath, record.sha256);
  return verified.ok ? "match" : "mismatch";
};

// A record only drives mutations for the row it was written for: the jobId,
// persisted checksum, and canonical source/destination names+paths must all
// match, otherwise the record is reported rather than trusted.
export const recordBinds = (
  record: JobRecord,
  jobId: string,
  checksum: string,
  sourcePath: string,
  linkPath: string,
): boolean =>
  record.jobId === jobId &&
  record.sha256 === checksum &&
  record.source.name === `${jobId}.pdf` &&
  record.source.path === sourcePath &&
  record.destination.name === `${jobId}-g1.pdf` &&
  record.destination.path === linkPath;

export const recordBindsCanonical = (
  record: JobRecord,
  root: string,
): boolean =>
  recordBinds(
    record,
    record.jobId,
    record.sha256,
    artifactPath(root, `${record.jobId}.pdf`),
    artifactPath(root, `${record.jobId}-g1.pdf`),
  );

export const writeTransition = async (
  root: string,
  record: Omit<JobRecord, "version" | "operation">,
): Promise<void> => {
  const dir = await ensureRecordsDir(root);
  await writeRecord(dir, { version: 1, operation: randomUUID(), ...record });
};

export interface ListedRecords {
  readonly entries: { readonly name: string; readonly read: RecordRead }[];
  /** Files that are not job records (e.g. crashed staging temps). */
  readonly strays: string[];
}

export const listRecords = async (
  recordsDir: string,
): Promise<ListedRecords | undefined> => {
  const stats = await lstat(recordsDir).catch((error: unknown) => {
    if (isFsError(error, "ENOENT")) return undefined;
    throw error;
  });
  if (stats === undefined) return undefined;
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new MigrationStateError(
      `records path is not a real directory: ${recordsDir}`,
    );
  }
  const names = await readdir(recordsDir);
  const entries: ListedRecords["entries"] = [];
  const strays: string[] = [];
  for (const name of names) {
    if (!name.endsWith(RECORD_SUFFIX)) {
      strays.push(name);
      continue;
    }
    entries.push({
      name,
      read: await readRecord(join(recordsDir, name)),
    });
  }
  return { entries, strays };
};
