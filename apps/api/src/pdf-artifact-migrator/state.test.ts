import { createHash } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  rmdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acquireRunLock,
  ensureRecordsDir,
  type JobRecord,
  listRecords,
  MigrationLockHeldError,
  MigrationStateError,
  readRecord,
  recordPathFor,
  recordsDirFor,
  writeRecord,
  writeTransition,
} from "./state.js";

const JOB_A = "a0000000-0000-4000-a000-000000000400";

const makeRecord = (root: string, state: JobRecord["state"]): JobRecord => ({
  version: 1,
  operation: "b1000000-0000-4000-a000-000000000500",
  jobId: JOB_A,
  source: {
    name: `${JOB_A}.pdf`,
    path: join(root, `${JOB_A}.pdf`),
    dev: "1",
    ino: "2",
  },
  destination: {
    name: `${JOB_A}-g1.pdf`,
    path: join(root, `${JOB_A}-g1.pdf`),
  },
  sha256: createHash("sha256").update("bytes").digest("hex"),
  state,
});

const fileHandleProto = async (): Promise<{
  sync: (this: FileHandle) => Promise<void>;
  writeFile: (
    this: FileHandle,
    data: string,
    options?: unknown,
  ) => Promise<void>;
}> => {
  const probe = await open(join(tmpdir(), "state-probe"), "w");
  const proto = Object.getPrototypeOf(probe) as {
    sync: (this: FileHandle) => Promise<void>;
    writeFile: (
      this: FileHandle,
      data: string,
      options?: unknown,
    ) => Promise<void>;
  };
  await probe.close();
  await rm(join(tmpdir(), "state-probe"), { force: true });
  return proto;
};

describe("migration state", () => {
  let root = "";
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "pdf-state-"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  describe("run lock", () => {
    it("acquires the lock directory and releases it on completion", async () => {
      const lock = await acquireRunLock(root);
      const stats = await lstat(join(root, ".migration", "lock"));
      expect(stats.isDirectory()).toBe(true);
      await lock.release();
      // A pure check leaves no records: the whole .migration dir is removed.
      await expect(lstat(join(root, ".migration"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    it("refuses a second acquire while the lock is held (EEXIST)", async () => {
      const lock = await acquireRunLock(root);
      await expect(acquireRunLock(root)).rejects.toBeInstanceOf(
        MigrationLockHeldError,
      );
      await lock.release();
    });

    it("refuses a stale lock until an operator removes the empty directory", async () => {
      await mkdir(join(root, ".migration", "lock"), { recursive: true });
      await expect(acquireRunLock(root)).rejects.toMatchObject({
        name: "MigrationLockHeldError",
      });
      // The lock stays until an operator removes only the empty lock dir.
      expect(
        (await lstat(join(root, ".migration", "lock"))).isDirectory(),
      ).toBe(true);
      await rmdir(join(root, ".migration", "lock"));
      const lock = await acquireRunLock(root);
      await lock.release();
    });

    it("keeps the .migration dir when records remain after release", async () => {
      const recordsDir = await ensureRecordsDir(root);
      await writeRecord(recordsDir, makeRecord(root, "committed"));
      const lock = await acquireRunLock(root);
      await lock.release();
      await expect(
        lstat(join(root, ".migration", "lock")),
      ).rejects.toMatchObject({ code: "ENOENT" });
      expect(
        (await lstat(join(root, ".migration", "records"))).isDirectory(),
      ).toBe(true);
    });

    it("does not force-clean a lock directory with foreign content", async () => {
      const lock = await acquireRunLock(root);
      await writeFile(join(root, ".migration", "lock", "foreign"), "x");
      await lock.release();
      // rmdir only removes empty dirs: foreign content keeps the lock.
      expect(
        (await lstat(join(root, ".migration", "lock"))).isDirectory(),
      ).toBe(true);
    });

    it("refuses a symlinked .migration directory", async () => {
      const outside = await mkdtemp(join(tmpdir(), "pdf-state-out-"));
      await symlink(outside, join(root, ".migration"));
      await expect(acquireRunLock(root)).rejects.toBeInstanceOf(
        MigrationStateError,
      );
      await rm(outside, { recursive: true, force: true });
    });
  });

  describe("records", () => {
    it("writes a strict JSON record with a trailing newline", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const record = makeRecord(root, "intent");
      await writeRecord(recordsDir, record);
      const raw = await readFile(recordPathFor(recordsDir, JOB_A), "utf8");
      expect(raw.endsWith("\n")).toBe(true);
      expect(raw.indexOf("\n")).toBe(raw.length - 1);
      const read = await readRecord(recordPathFor(recordsDir, JOB_A));
      expect(read).toEqual({ kind: "ok", record });
    });

    it("returns absent for a missing record", async () => {
      const read = await readRecord(
        join(root, ".migration", "records", `${JOB_A}.json`),
      );
      expect(read).toEqual({ kind: "absent" });
    });

    it("rejects a record without a final newline", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const path = recordPathFor(recordsDir, JOB_A);
      await writeFile(path, JSON.stringify(makeRecord(root, "intent")));
      const read = await readRecord(path);
      expect(read).toEqual({
        kind: "corrupt",
        detail: "record-truncated-or-multiline",
      });
    });

    it("rejects malformed JSON and wrong schema", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const path = recordPathFor(recordsDir, JOB_A);
      await writeFile(path, "not-json\n");
      expect(await readRecord(path)).toEqual({
        kind: "corrupt",
        detail: "record-malformed-json",
      });
      await writeFile(path, `${JSON.stringify({ jobId: JOB_A })}\n`);
      expect(await readRecord(path)).toEqual({
        kind: "corrupt",
        detail: "record-schema",
      });
    });

    it("rejects a record whose dev or ino is not a decimal string", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const path = recordPathFor(recordsDir, JOB_A);
      for (const source of [
        { ...makeRecord(root, "intent").source, dev: "not-a-device" },
        { ...makeRecord(root, "intent").source, ino: "12x4" },
        { ...makeRecord(root, "intent").source, ino: "" },
      ]) {
        await writeFile(
          path,
          `${JSON.stringify({ ...makeRecord(root, "intent"), source })}\n`,
        );
        expect(await readRecord(path)).toEqual({
          kind: "corrupt",
          detail: "record-schema",
        });
      }
    });

    it("rejects an unknown state value", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const path = recordPathFor(recordsDir, JOB_A);
      await writeFile(
        path,
        `${JSON.stringify({ ...makeRecord(root, "intent"), state: "bogus" })}\n`,
      );
      expect(await readRecord(path)).toEqual({
        kind: "corrupt",
        detail: "record-schema",
      });
    });

    it("rejects a symlinked record", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const real = join(root, "elsewhere.json");
      await writeFile(real, `${JSON.stringify(makeRecord(root, "intent"))}\n`);
      const path = recordPathFor(recordsDir, JOB_A);
      await symlink(real, path);
      expect(await readRecord(path)).toEqual({
        kind: "corrupt",
        detail: "record-symlink",
      });
    });

    it("rejects a non-regular record path", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const path = recordPathFor(recordsDir, JOB_A);
      await mkdir(path);
      expect(await readRecord(path)).toEqual({
        kind: "corrupt",
        detail: "record-not-regular",
      });
    });

    it("leaves preexisting temp files untouched on successful writes", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const foreignTemp = join(recordsDir, "stale-temp.tmp");
      await writeFile(foreignTemp, "sentinel");
      await writeRecord(recordsDir, makeRecord(root, "intent"));
      expect(await readFile(foreignTemp, "utf8")).toBe("sentinel");
      // The new record is the only .json entry; the foreign temp is listed
      // as a stray, never silently deleted.
      const listed = await listRecords(recordsDir);
      expect(listed?.strays).toEqual(["stale-temp.tmp"]);
      expect(listed?.entries).toHaveLength(1);
    });

    it("propagates a write error, leaves no record, and cleans only its temp", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const foreignTemp = join(recordsDir, "keep.tmp");
      await writeFile(foreignTemp, "keep");
      const proto = await fileHandleProto();
      vi.spyOn(proto, "writeFile").mockRejectedValue(
        Object.assign(new Error("no space"), { code: "ENOSPC" }),
      );
      await expect(
        writeRecord(recordsDir, makeRecord(root, "intent")),
      ).rejects.toMatchObject({ code: "ENOSPC" });
      // Temp cleaned, foreign temp preserved, no record written.
      const names = await readdir(recordsDir);
      expect(names).toEqual(["keep.tmp"]);
    });

    it("propagates an fsync error without writing a record", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const proto = await fileHandleProto();
      vi.spyOn(proto, "sync").mockRejectedValue(new Error("sync failed"));
      await expect(
        writeRecord(recordsDir, makeRecord(root, "intent")),
      ).rejects.toThrow("sync failed");
      expect(await readdir(recordsDir)).toEqual([]);
      expect(await readRecord(recordPathFor(recordsDir, JOB_A))).toEqual({
        kind: "absent",
      });
    });

    it("propagates a rename error and never truncates an existing record", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const recordPath = recordPathFor(recordsDir, JOB_A);
      // A directory at the record path makes rename(temp, recordPath) fail.
      await mkdir(recordPath);
      await expect(
        writeRecord(recordsDir, makeRecord(root, "committed")),
      ).rejects.toThrow();
      expect((await lstat(recordPath)).isDirectory()).toBe(true);
    });

    it("atomically replaces an existing record through a new transition", async () => {
      const recordsDir = await ensureRecordsDir(root);
      const intent = makeRecord(root, "intent");
      await writeRecord(recordsDir, intent);
      const committed = {
        ...intent,
        operation: "b1000000-0000-4000-a000-000000000501",
        state: "committed" as const,
      };
      await writeRecord(recordsDir, committed);
      const read = await readRecord(recordPathFor(recordsDir, JOB_A));
      expect(read).toEqual({ kind: "ok", record: committed });
    });

    it("lists records with strays and refuses a non-directory records path", async () => {
      const recordsDir = await ensureRecordsDir(root);
      await writeRecord(recordsDir, makeRecord(root, "committed"));
      await writeFile(join(recordsDir, "leftover.tmp"), "x");
      const listed = await listRecords(recordsDir);
      expect(listed?.entries).toHaveLength(1);
      expect(listed?.strays).toEqual(["leftover.tmp"]);

      await rm(recordsDir, { recursive: true });
      await symlink(root, recordsDir);
      await expect(listRecords(recordsDir)).rejects.toBeInstanceOf(
        MigrationStateError,
      );
    });

    it("writeTransition ensures the records dir and stamps a fresh operation UUID", async () => {
      await writeTransition(root, {
        jobId: JOB_A,
        source: makeRecord(root, "intent").source,
        destination: makeRecord(root, "intent").destination,
        sha256: makeRecord(root, "intent").sha256,
        state: "intent",
      });
      const read = await readRecord(recordPathFor(recordsDirFor(root), JOB_A));
      expect(read.kind).toBe("ok");
      if (read.kind === "ok") {
        expect(read.record.operation).not.toBe(
          "b1000000-0000-4000-a000-000000000500",
        );
        expect(read.record.state).toBe("intent");
      }
    });
  });
});
