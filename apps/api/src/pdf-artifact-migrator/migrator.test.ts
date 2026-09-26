import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import {
  lstat,
  mkdir,
  mkdtemp,
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

import type { MigratorConfig } from "./config.js";
import type { ArtifactRowSource, CompletedArtifactRow } from "./db.js";
import {
  EXIT_OK,
  EXIT_REFUSED,
  EXIT_UNRESOLVED,
  type MigratorEvent,
  type MigratorMode,
  runMigrator,
} from "./migrator.js";
import type { JobRecord } from "./state.js";
import { recordPathFor, recordsDirFor, writeRecord } from "./state.js";

const sha256 = (bytes: string | Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const JOB_A = "a0000000-0000-4000-a000-000000000400";
const JOB_B = "a0000000-0000-4000-a000-000000000401";
const CONFIRM = "db.example.com|5432|testdb";
const LOCK_DIR = join(".migration", "lock");
const RECORDS_DIR = join(".migration", "records");

interface FakeSource extends ArtifactRowSource {
  readonly listCount: () => number;
}

const makeConfig = (
  root: string,
  mode: MigratorMode,
  confirmation?: string,
): MigratorConfig => ({
  mode,
  databaseUrl: "postgresql://u:p@db.example.com:5432/testdb",
  target: { host: "db.example.com", port: "5432", database: "testdb" },
  artifactRoot: root,
  confirmation,
});

const fakeSource = (rows: CompletedArtifactRow[]): FakeSource => {
  const list = vi.fn(async () => Promise.resolve(rows));
  return {
    listCount: () => list.mock.calls.length,
    listRows: list,
    close: async () => Promise.resolve(),
  };
};

const run = async (
  root: string,
  mode: MigratorMode,
  rows: CompletedArtifactRow[],
  confirmation?: string,
) => {
  const source = fakeSource(rows);
  const openSource = vi.fn(async () => Promise.resolve(source));
  const events: MigratorEvent[] = [];
  const outcome = await runMigrator(
    makeConfig(root, mode, confirmation),
    { openSource },
    (event) => events.push(event),
  );
  return { outcome, events, source, openSource };
};

const rowEvents = (events: MigratorEvent[]) =>
  events.flatMap((event) => (event.type === "row" ? [event] : []));

const writePdf = async (
  root: string,
  name: string,
  bytes: string,
): Promise<string> => {
  const path = join(root, name);
  await writeFile(path, bytes);
  return path;
};

interface Fixture {
  readonly jobId: string;
  readonly bytes: string;
  readonly sourcePath: string;
  readonly destPath: string;
  readonly ino: number;
  readonly dev: number;
}

const seedSource = async (
  root: string,
  jobId: string,
  bytes: string,
): Promise<Fixture> => {
  const sourcePath = await writePdf(root, `${jobId}.pdf`, bytes);
  const stats = await lstat(sourcePath);
  return {
    jobId,
    bytes,
    sourcePath,
    destPath: join(root, `${jobId}-g1.pdf`),
    ino: stats.ino,
    dev: stats.dev,
  };
};

// A deterministic crash fixture: the exact durable record a killed run would
// have left at a transition boundary.
const seedRecord = async (
  root: string,
  fixture: Fixture,
  state: JobRecord["state"],
): Promise<JobRecord> => {
  const record: JobRecord = {
    version: 1,
    operation: randomUUID(),
    jobId: fixture.jobId,
    source: {
      name: `${fixture.jobId}.pdf`,
      path: fixture.sourcePath,
      dev: String(fixture.dev),
      ino: String(fixture.ino),
    },
    destination: {
      name: `${fixture.jobId}-g1.pdf`,
      path: fixture.destPath,
    },
    sha256: sha256(fixture.bytes),
    state,
  };
  await mkdir(join(root, RECORDS_DIR), { recursive: true });
  await writeRecord(join(root, RECORDS_DIR), record);
  return record;
};

const recordFile = async (root: string, jobId: string): Promise<JobRecord> =>
  JSON.parse(
    (await readFile(recordPathFor(recordsDirFor(root), jobId), "utf8")).trim(),
  ) as JobRecord;

describe("pdf-artifact-migrator", () => {
  let root = "";
  const rowFor = (jobId: string, bytes: string): CompletedArtifactRow => ({
    jobId,
    checksum: sha256(bytes),
  });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "pdf-migrator-"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  describe("run lock", () => {
    it("refuses every mode while the lock is held", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      const rows = [rowFor(JOB_A, "%PDF-a")];
      // Hold the first apply's row listing open so the lock stays acquired
      // while a concurrent run attempts all modes.
      const gate = Promise.withResolvers<CompletedArtifactRow[]>();
      const heldSource: ArtifactRowSource = {
        listRows: () => gate.promise,
        close: () => Promise.resolve(),
      };
      // openSource runs only after the lock is held: awaiting this proves the
      // held run owns the lock before the blocked runs attempt it.
      const heldReady = Promise.withResolvers<void>();
      const heldEvents: MigratorEvent[] = [];
      const held = runMigrator(
        makeConfig(root, "apply", CONFIRM),
        {
          openSource: () => {
            heldReady.resolve();
            return Promise.resolve(heldSource);
          },
        },
        (event) => heldEvents.push(event),
      );
      await heldReady.promise;
      try {
        for (const mode of ["check", "apply", "rollback"] as const) {
          const blocked = await run(
            root,
            mode,
            rows,
            mode === "check" ? undefined : CONFIRM,
          );
          expect(blocked.outcome.exitCode).toBe(EXIT_REFUSED);
          expect(
            blocked.events.some(
              (event) =>
                event.type === "refusal" &&
                event.message.includes("migration lock is held"),
            ),
          ).toBe(true);
          expect(blocked.openSource).not.toHaveBeenCalled();
        }
      } finally {
        gate.resolve(rows);
        const heldOutcome = await held;
        expect(heldOutcome.exitCode).toBe(EXIT_OK);
      }
      // Normal completion removed the lock.
      await expect(lstat(join(root, LOCK_DIR))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    it("refuses a stale lock until an operator removes the empty directory", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      await mkdir(join(root, LOCK_DIR), { recursive: true });

      const refused = await run(root, "check", [rowFor(JOB_A, "%PDF-a")]);
      expect(refused.outcome.exitCode).toBe(EXIT_REFUSED);
      // The stale lock is never reclaimed: it survives until an operator,
      // having quiesced migrators, removes only the empty lock directory.
      expect((await lstat(join(root, LOCK_DIR))).isDirectory()).toBe(true);
      expect(await readdir(root)).not.toContain(`${JOB_A}-g1.pdf`);

      await rmdir(join(root, LOCK_DIR));
      const rerun = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rerun.outcome.exitCode).toBe(EXIT_OK);
      expect(rowEvents(rerun.events)[0]?.verdict).toBe("linked");
    });

    it("keeps the lock after a real child process is killed mid-run", async () => {
      // A child running the real acquireRunLock is SIGKILLed while holding the
      // lock: the lock directory must survive the dead process, refuse the
      // next run, and yield only to explicit operator removal.
      const script = join(root, "lock-crash.mts");
      const stateModule = new URL(
        "./state.js",
        import.meta.url,
      ).pathname.replace(/\.js$/u, ".ts");
      const tsxBin = new URL("../../node_modules/.bin/tsx", import.meta.url)
        .pathname;
      await writeFile(
        script,
        `import { acquireRunLock } from ${JSON.stringify(stateModule)};\n` +
          `await acquireRunLock(${JSON.stringify(root)});\n` +
          `process.stdout.write("locked\\n");\n` +
          `process.kill(process.pid, "SIGKILL");\n`,
      );
      const child = spawn(tsxBin, [script], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const exit = await new Promise<{
        code: number | null;
        signal: NodeJS.Signals | null;
      }>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      // tsx relays the kill as exit 137 (128+SIGKILL) rather than a signal.
      expect(exit.signal === "SIGKILL" || exit.code === 137).toBe(true);

      // The dead process's lock persists; no PID/age/heartbeat reclaims it.
      expect((await lstat(join(root, LOCK_DIR))).isDirectory()).toBe(true);
      const refused = await run(root, "check", []);
      expect(refused.outcome.exitCode).toBe(EXIT_REFUSED);
      expect(
        refused.events.some(
          (event) =>
            event.type === "refusal" &&
            event.message.includes("migration lock is held"),
        ),
      ).toBe(true);

      // Controlled recovery: operator removes only the empty lock directory.
      await rmdir(join(root, LOCK_DIR));
      const rerun = await run(root, "check", []);
      expect(rerun.outcome.exitCode).toBe(EXIT_OK);
    });
  });

  describe("check mode", () => {
    it("reports would-link for a verified legacy file missing its -g1 link", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      const { outcome, events } = await run(root, "check", [
        rowFor(JOB_A, "%PDF-a"),
      ]);
      expect(rowEvents(events)).toEqual([
        { type: "row", jobId: JOB_A, verdict: "would-link" },
      ]);
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
    });

    it("creates nothing: no -g1 file and .migration is removed after check", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      await run(root, "check", [rowFor(JOB_A, "%PDF-a")]);
      expect(await readdir(root)).toEqual([`${JOB_A}.pdf`]);
    });

    it("treats a matching -g1 file with NO record as foreign, never success", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      // Even a true hard link to the source is foreign without a record.
      await writePdf(root, `${JOB_A}-g1.pdf`, "%PDF-a");
      const { outcome, events } = await run(root, "check", [
        rowFor(JOB_A, "%PDF-a"),
      ]);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(rowEvents(events)[0]?.detail).toContain("destination-foreign");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect((await lstat(fixture.destPath)).isFile()).toBe(true);
    });

    it("reports already-linked only when a committed record verifies", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await mkdir(join(root, RECORDS_DIR), { recursive: true });
      await writePdf(root, `${JOB_A}-g1.pdf`, "%PDF-a");
      // A regular file is not a recorded link: committed requires same inode.
      // Build the fixture via apply so record + link agree.
      await rm(join(root, RECORDS_DIR), { recursive: true });
      await rm(fixture.destPath);
      await run(root, "apply", [rowFor(JOB_A, "%PDF-a")], CONFIRM);
      const { outcome, events } = await run(root, "check", [
        rowFor(JOB_A, "%PDF-a"),
      ]);
      expect(rowEvents(events)[0]?.verdict).toBe("already-linked");
      expect(outcome.exitCode).toBe(EXIT_OK);
    });

    it("never reports success for an intent record, whatever the dest", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "intent");
      const absent = await run(root, "check", [rowFor(JOB_A, "%PDF-a")]);
      expect(rowEvents(absent.events)[0]?.verdict).toBe("skipped-anomaly");
      expect(absent.outcome.exitCode).toBe(EXIT_UNRESOLVED);

      // Crash left the link but not the commit: still not a success.
      const { link } = await import("node:fs/promises");
      await link(fixture.sourcePath, fixture.destPath);
      const linked = await run(root, "check", [rowFor(JOB_A, "%PDF-a")]);
      expect(rowEvents(linked.events)[0]?.verdict).toBe("skipped-anomaly");
      expect(rowEvents(linked.events)[0]?.detail).toContain("uncommitted");
    });

    it("never reports success for a rollback-intent record", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "rollback-intent");
      const { outcome, events } = await run(root, "check", [
        rowFor(JOB_A, "%PDF-a"),
      ]);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
    });

    it("refuses success on a corrupt record", async () => {
      await seedSource(root, JOB_A, "%PDF-a");
      await mkdir(join(root, RECORDS_DIR), { recursive: true });
      await writeFile(
        recordPathFor(recordsDirFor(root), JOB_A),
        JSON.stringify({ jobId: JOB_A }).slice(0, 12),
      );
      const { outcome, events } = await run(root, "check", [
        rowFor(JOB_A, "%PDF-a"),
      ]);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(rowEvents(events)[0]?.detail).toContain("record-");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
    });

    it("reports anomalies for missing/symlink/checksum-bad sources and bad rows", async () => {
      const { outcome, events } = await run(root, "check", [
        rowFor(JOB_A, "%PDF-a"),
      ]);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(rowEvents(events)[0]?.detail).toContain("missing");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);

      const real = await writePdf(root, "real.pdf", "%PDF-a");
      await symlink(real, join(root, `${JOB_A}.pdf`));
      const sym = await run(root, "check", [rowFor(JOB_A, "%PDF-a")]);
      expect(rowEvents(sym.events)[0]?.detail).toContain("symlink");

      await rm(join(root, `${JOB_A}.pdf`));
      await writePdf(root, `${JOB_A}.pdf`, "tampered");
      const bad = await run(root, "check", [rowFor(JOB_A, "%PDF-a")]);
      expect(rowEvents(bad.events)[0]?.detail).toContain("checksum");

      const nonUuid = await run(root, "check", [
        { jobId: "../escape", checksum: sha256("x") },
      ]);
      expect(rowEvents(nonUuid.events)[0]?.detail).toContain("uuid");
      const nullChecksum = await run(root, "check", [
        { jobId: JOB_A, checksum: null },
      ]);
      expect(rowEvents(nullChecksum.events)[0]?.verdict).toBe(
        "skipped-anomaly",
      );
    });

    it("fails check on a corrupt record even when no rows are selected", async () => {
      await mkdir(join(root, RECORDS_DIR), { recursive: true });
      await writeFile(join(root, RECORDS_DIR, `${JOB_A}.json`), '{"broken":\n');
      const { outcome, events } = await run(root, "check", []);
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(
        rowEvents(events).some((event) =>
          event.detail?.includes("record-malformed-json"),
        ),
      ).toBe(true);
    });

    it("fails check on an unfinished record for an unselected job", async () => {
      const fixture = await seedSource(root, JOB_B, "%PDF-b");
      await seedRecord(root, fixture, "intent");
      const { outcome, events } = await run(root, "check", []);
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(
        rowEvents(events).some((event) =>
          event.detail?.includes("record-intent-uncommitted"),
        ),
      ).toBe(true);
      // Nothing was mutated: the pending link was not created.
      await expect(lstat(fixture.destPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    it("reports stray files inside records as anomalies", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      await mkdir(join(root, RECORDS_DIR), { recursive: true });
      await writeFile(join(root, RECORDS_DIR, "crashed.tmp"), "partial");
      const { outcome, events } = await run(root, "check", [
        rowFor(JOB_A, "%PDF-a"),
      ]);
      expect(
        rowEvents(events).some((event) =>
          event.detail?.includes("record-stray:crashed.tmp"),
        ),
      ).toBe(true);
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      // The stray is reported, never deleted.
      expect(
        await readFile(join(root, RECORDS_DIR, "crashed.tmp"), "utf8"),
      ).toBe("partial");
    });

    it("exits 0 when there is nothing to do", async () => {
      const { outcome } = await run(root, "check", []);
      expect(outcome.exitCode).toBe(EXIT_OK);
    });
  });

  describe("apply mode", () => {
    it("refuses without the target-bound confirmation before touching anything", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      const { outcome, openSource, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        undefined,
      );
      expect(outcome.exitCode).toBe(EXIT_REFUSED);
      expect(openSource).not.toHaveBeenCalled();
      expect(events.some((event) => event.type === "refusal")).toBe(true);
      expect(await readdir(root)).toEqual([`${JOB_A}.pdf`]);
    });

    it("refuses a confirmation bound to a different target", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      const { outcome, openSource } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        "other-host|5432|testdb",
      );
      expect(outcome.exitCode).toBe(EXIT_REFUSED);
      expect(openSource).not.toHaveBeenCalled();
    });

    it("links a verified file, records it committed, keeps the legacy entry", async () => {
      const sourcePath = await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(outcome.exitCode).toBe(EXIT_OK);
      expect(rowEvents(events)[0]?.verdict).toBe("linked");

      const linkPath = join(root, `${JOB_A}-g1.pdf`);
      const sourceStat = await lstat(sourcePath);
      const linkStat = await lstat(linkPath);
      expect(linkStat.ino).toBe(sourceStat.ino);
      expect(await readFile(linkPath, "utf8")).toBe("%PDF-a");

      const record = await recordFile(root, JOB_A);
      expect(record).toMatchObject({
        version: 1,
        jobId: JOB_A,
        sha256: sha256("%PDF-a"),
        state: "committed",
        source: {
          name: `${JOB_A}.pdf`,
          path: sourcePath,
          dev: String(sourceStat.dev),
          ino: String(sourceStat.ino),
        },
        destination: { name: `${JOB_A}-g1.pdf`, path: linkPath },
      });
      // Lock released; state dir holds only the record.
      expect(await readdir(join(root, ".migration"))).toEqual(["records"]);
    });

    it("is idempotent: rerun reports already-linked with one record", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      const rows = [rowFor(JOB_A, "%PDF-a")];
      await run(root, "apply", rows, CONFIRM);
      const second = await run(root, "apply", rows, CONFIRM);
      expect(second.outcome.exitCode).toBe(EXIT_OK);
      expect(rowEvents(second.events)[0]?.verdict).toBe("already-linked");
      expect(await readdir(join(root, RECORDS_DIR))).toEqual([`${JOB_A}.json`]);
    });

    it("treats an EEXIST hard link without a record as foreign, never owns it", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      // A real hard link to the same inode, created outside the protocol.
      const { link } = await import("node:fs/promises");
      await link(fixture.sourcePath, fixture.destPath);
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(rowEvents(events)[0]?.detail).toContain("destination-foreign");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      // Foreign link preserved and no record written: nothing may ever claim
      // ownership of a destination that predates the intent.
      expect((await lstat(fixture.destPath)).ino).toBe(fixture.ino);
      await expect(
        lstat(recordPathFor(recordsDirFor(root), JOB_A)),
      ).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("never adopts a foreign -g1 link on repeated apply, and rollback preserves it", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      const { link } = await import("node:fs/promises");
      await link(fixture.sourcePath, fixture.destPath);
      const rows = [rowFor(JOB_A, "%PDF-a")];

      for (const attempt of ["first", "second"]) {
        const { outcome, events } = await run(root, "apply", rows, CONFIRM);
        expect(outcome.exitCode, attempt).toBe(EXIT_UNRESOLVED);
        expect(rowEvents(events)[0]?.detail).toContain("destination-foreign");
        await expect(
          lstat(recordPathFor(recordsDirFor(root), JOB_A)),
          attempt,
        ).rejects.toMatchObject({ code: "ENOENT" });
      }

      const rolled = await run(root, "rollback", [], CONFIRM);
      expect(rolled.outcome.exitCode).toBe(EXIT_OK);
      // The foreign link is still exactly the entry that predates migration.
      expect((await lstat(fixture.destPath)).ino).toBe(fixture.ino);
    });

    it("reports an EEXIST destination with wrong bytes as anomaly, never replaces", async () => {
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      const dest = await writePdf(root, `${JOB_A}-g1.pdf`, "WRONG");
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(await readFile(dest, "utf8")).toBe("WRONG");
    });

    it("rejects a symlinked destination without following it", async () => {
      const outside = await writePdf(root, "outside.pdf", "outside-bytes");
      await writePdf(root, `${JOB_A}.pdf`, "%PDF-a");
      await symlink(outside, join(root, `${JOB_A}-g1.pdf`));
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(await readFile(outside, "utf8")).toBe("outside-bytes");
      expect(
        (await lstat(join(root, `${JOB_A}-g1.pdf`))).isSymbolicLink(),
      ).toBe(true);
    });

    it("keeps going per-row: one anomaly does not stop later links", async () => {
      await writePdf(root, `${JOB_B}.pdf`, "%PDF-b");
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a"), rowFor(JOB_B, "%PDF-b")],
        CONFIRM,
      );
      const verdicts = rowEvents(events).map((event) => event.verdict);
      expect(verdicts).toEqual(["skipped-anomaly", "linked"]);
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
    });

    it("refuses to relink an intent whose recorded source identity is stale", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      const record = await seedRecord(root, fixture, "intent");
      // The live source was replaced with identical bytes between the crash
      // and this run: checksum still matches, but the recorded inode is
      // stale — linking would migrate a file the record does not describe.
      await writeRecord(join(root, RECORDS_DIR), {
        ...record,
        source: { ...record.source, ino: String(fixture.ino + 1) },
      });
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(rowEvents(events)[0]?.detail).toContain(
        "record-intent-source-mismatch",
      );
      await expect(lstat(fixture.destPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    it("fsyncs the .migration hierarchy before the link is created", async () => {
      await seedSource(root, JOB_A, "%PDF-a");
      const artifacts = await import("./artifacts.js");
      const realSync = artifacts.syncDirectory;
      const realLink = artifacts.linkNoOverwrite;
      const order: string[] = [];
      vi.spyOn(artifacts, "syncDirectory").mockImplementation(
        async (directoryPath: string) => {
          order.push(`fsync:${directoryPath}`);
          return realSync(directoryPath);
        },
      );
      vi.spyOn(artifacts, "linkNoOverwrite").mockImplementation(
        async (sourcePath: string, linkPath: string) => {
          order.push("link");
          return realLink(sourcePath, linkPath);
        },
      );

      const { outcome } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(outcome.exitCode).toBe(EXIT_OK);
      const linkAt = order.indexOf("link");
      expect(linkAt).toBeGreaterThan(-1);
      // The artifact root fsync persists the .migration dirent and the
      // .migration fsync persists the records dirent — both must land before
      // any link exists.
      expect(order.indexOf(`fsync:${root}`)).toBeLessThan(linkAt);
      expect(order.indexOf(`fsync:${root}`)).toBeGreaterThan(-1);
      const migrationSync = order.indexOf(`fsync:${join(root, ".migration")}`);
      expect(migrationSync).toBeGreaterThan(-1);
      expect(migrationSync).toBeLessThan(linkAt);
    });

    it("recovers a crashed intent with no link: retries the link, commits", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "intent");
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(events)[0]?.verdict).toBe("linked");
      expect(outcome.exitCode).toBe(EXIT_OK);
      expect((await lstat(fixture.destPath)).ino).toBe(fixture.ino);
      expect((await recordFile(root, JOB_A)).state).toBe("committed");
    });

    it("recovers a crashed intent whose link was already created", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "intent");
      // Crash between link() and the committed write.
      const { link } = await import("node:fs/promises");
      await link(fixture.sourcePath, fixture.destPath);
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(events)[0]?.verdict).toBe("linked");
      expect(outcome.exitCode).toBe(EXIT_OK);
      expect((await recordFile(root, JOB_A)).state).toBe("committed");
    });

    it("fails a crashed intent whose destination mismatches, deleting nothing", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "intent");
      await writeFile(fixture.destPath, "foreign");
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(await readFile(fixture.destPath, "utf8")).toBe("foreign");
      expect((await recordFile(root, JOB_A)).state).toBe("intent");
    });

    it("blocks mutation while a record is corrupt, symlinked, or mismatched", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      const recordsDir = await mkdir(join(root, RECORDS_DIR), {
        recursive: true,
      }).then(() => join(root, RECORDS_DIR));
      const recordPath = recordPathFor(recordsDir, JOB_A);

      // Corrupt JSON.
      await writeFile(recordPath, "{not json\n");
      let res = await run(root, "apply", [rowFor(JOB_A, "%PDF-a")], CONFIRM);
      expect(rowEvents(res.events)[0]?.verdict).toBe("skipped-anomaly");
      expect(await readdir(root)).not.toContain(`${JOB_A}-g1.pdf`);

      // Symlinked record.
      const real = join(root, "real-record.json");
      await writeFile(real, `${JSON.stringify({})}\n`);
      await rm(recordPath);
      await symlink(real, recordPath);
      res = await run(root, "apply", [rowFor(JOB_A, "%PDF-a")], CONFIRM);
      expect(rowEvents(res.events)[0]?.detail).toContain("record-symlink");

      // Valid schema bound to different content (checksum mismatch).
      await rm(recordPath);
      const wrongChecksum = {
        ...(await seedRecord(
          root,
          { ...fixture, bytes: "other-bytes" },
          "committed",
        )),
      };
      expect(wrongChecksum.jobId).toBe(JOB_A);
      res = await run(root, "apply", [rowFor(JOB_A, "%PDF-a")], CONFIRM);
      expect(rowEvents(res.events)[0]?.detail).toContain("record-mismatch");
      expect(await readdir(root)).not.toContain(`${JOB_A}-g1.pdf`);
    });

    it("refuses apply while a rollback-intent record is pending", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "rollback-intent");
      const { outcome, events } = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(events)[0]?.detail).toContain("rollback-intent");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(await readdir(root)).not.toContain(`${JOB_A}-g1.pdf`);
    });

    it("keeps an intent recoverable when the commit write fails after link", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      // Fail the second staged record write (the committed transition) after
      // the link exists: identical boundary to a crash between link and commit.
      const probe = await import("node:fs/promises").then((fs) =>
        fs.open(join(root, "proto-probe"), "w"),
      );
      const proto = Object.getPrototypeOf(probe) as {
        writeFile: (
          this: FileHandle,
          data: string,
          options?: unknown,
        ) => Promise<void>;
      };
      await probe.close();
      await rm(join(root, "proto-probe"));
      const realWrite = proto.writeFile;
      let calls = 0;
      vi.spyOn(proto, "writeFile").mockImplementation(function (
        this: FileHandle,
        data,
        options,
      ) {
        calls += 1;
        if (calls === 2) {
          return Promise.reject(
            Object.assign(new Error("no space"), { code: "ENOSPC" }),
          );
        }
        return realWrite.call(this, data, options);
      });

      const failed = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(failed.outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(rowEvents(failed.events)[0]?.verdict).toBe("skipped-anomaly");
      // Crash boundary state: link on disk, durable record still intent.
      expect((await lstat(fixture.destPath)).ino).toBe(fixture.ino);
      expect((await recordFile(root, JOB_A)).state).toBe("intent");
      vi.restoreAllMocks();

      // The next run recovers the intent: link matches -> committed.
      const retried = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(retried.outcome.exitCode).toBe(EXIT_OK);
      expect(rowEvents(retried.events)[0]?.verdict).toBe("linked");
      expect((await recordFile(root, JOB_A)).state).toBe("committed");
    });

    it("reports a committed record whose destination vanished or changed", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await run(root, "apply", [rowFor(JOB_A, "%PDF-a")], CONFIRM);
      await rm(fixture.destPath);
      const missing = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(missing.events)[0]?.detail).toContain(
        "record-committed-dest-absent",
      );
      await writeFile(fixture.destPath, "replaced");
      const changed = await run(
        root,
        "apply",
        [rowFor(JOB_A, "%PDF-a")],
        CONFIRM,
      );
      expect(rowEvents(changed.events)[0]?.detail).toContain(
        "record-committed-dest-mismatch",
      );
    });
  });

  describe("rollback mode", () => {
    const applied = async (jobs: [string, string][]) => {
      const rows = jobs.map(([jobId, bytes]) => rowFor(jobId, bytes));
      for (const [jobId, bytes] of jobs) {
        await writePdf(root, `${jobId}.pdf`, bytes);
      }
      return run(root, "apply", rows, CONFIRM);
    };

    it("refuses without confirmation", async () => {
      const { outcome } = await run(root, "rollback", [], undefined);
      expect(outcome.exitCode).toBe(EXIT_REFUSED);
    });

    it("exits 0 when no records exist: nothing record-owned", async () => {
      const { outcome } = await run(root, "rollback", [], CONFIRM);
      expect(outcome.exitCode).toBe(EXIT_OK);
    });

    it("removes only record-owned links and keeps legacy files", async () => {
      await applied([
        [JOB_A, "%PDF-a"],
        [JOB_B, "%PDF-b"],
      ]);
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      expect(outcome.exitCode).toBe(EXIT_OK);
      expect(rowEvents(events).map((event) => event.verdict)).toEqual([
        "removed",
        "removed",
      ]);
      const records = await readdir(join(root, RECORDS_DIR));
      expect(records.toSorted()).toEqual([`${JOB_A}.json`, `${JOB_B}.json`]);
      for (const jobId of [JOB_A, JOB_B]) {
        expect((await recordFile(root, jobId)).state).toBe("rolled-back");
      }
      expect(await readdir(root)).toEqual(
        [".migration", `${JOB_A}.pdf`, `${JOB_B}.pdf`].sort(),
      );
    });

    it("leaves an intent record for apply to resolve, unlinking nothing", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "intent");
      // The crashed run's link is already on disk — still not committed.
      const { link } = await import("node:fs/promises");
      await link(fixture.sourcePath, fixture.destPath);
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(rowEvents(events)[0]?.detail).toContain("record-intent");
      expect((await lstat(fixture.destPath)).ino).toBe(fixture.ino);
      expect((await recordFile(root, JOB_A)).state).toBe("intent");
    });

    it("leaves a recorded link whose inode changed (replaced) as anomaly", async () => {
      await applied([[JOB_A, "%PDF-a"]]);
      const linkPath = join(root, `${JOB_A}-g1.pdf`);
      await rm(linkPath);
      await writeFile(linkPath, "%PDF-a");
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect((await lstat(linkPath)).isFile()).toBe(true);
      expect((await recordFile(root, JOB_A)).state).toBe("committed");
    });

    it("finalizes rolled-back when a recorded link was deleted between runs", async () => {
      await applied([[JOB_A, "%PDF-a"]]);
      await rm(join(root, `${JOB_A}-g1.pdf`));
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      expect(rowEvents(events)[0]?.verdict).toBe("already-absent");
      expect(outcome.exitCode).toBe(EXIT_OK);
      expect((await recordFile(root, JOB_A)).state).toBe("rolled-back");
    });

    it("recovers a crashed rollback-intent: retries unlink, then rolled-back", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await run(root, "apply", [rowFor(JOB_A, "%PDF-a")], CONFIRM);
      // Force the record back to the crash boundary: link still live.
      await seedRecord(root, fixture, "rollback-intent");
      const first = await run(root, "rollback", [], CONFIRM);
      expect(rowEvents(first.events)[0]?.verdict).toBe("removed");
      expect(first.outcome.exitCode).toBe(EXIT_OK);
      expect(await readdir(root)).not.toContain(`${JOB_A}-g1.pdf`);
      expect((await recordFile(root, JOB_A)).state).toBe("rolled-back");

      // Idempotent: a second rollback is a clean already-absent.
      const second = await run(root, "rollback", [], CONFIRM);
      expect(rowEvents(second.events)[0]?.verdict).toBe("already-absent");
      expect(second.outcome.exitCode).toBe(EXIT_OK);
    });

    it("finalizes a crashed rollback-intent whose link is already gone", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "rollback-intent");
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      expect(rowEvents(events)[0]?.verdict).toBe("already-absent");
      expect(outcome.exitCode).toBe(EXIT_OK);
      expect((await recordFile(root, JOB_A)).state).toBe("rolled-back");
    });

    it("fails a rollback-intent whose destination mismatches, deleting nothing", async () => {
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      await seedRecord(root, fixture, "rollback-intent");
      await writeFile(fixture.destPath, "foreign");
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(await readFile(fixture.destPath, "utf8")).toBe("foreign");
    });

    it("never touches files the records do not own", async () => {
      await applied([[JOB_A, "%PDF-a"]]);
      await writePdf(root, `${JOB_B}-g1.pdf`, "%PDF-b");
      await writePdf(root, `${JOB_A}-g2.pdf`, "%PDF-a-g2");
      const { outcome } = await run(root, "rollback", [], CONFIRM);
      expect(outcome.exitCode).toBe(EXIT_OK);
      expect(await readFile(join(root, `${JOB_B}-g1.pdf`), "utf8")).toBe(
        "%PDF-b",
      );
      expect(await readFile(join(root, `${JOB_A}-g2.pdf`), "utf8")).toBe(
        "%PDF-a-g2",
      );
    });

    it("refuses a record whose destination path escapes the artifact root", async () => {
      const escapeDir = await mkdtemp(join(tmpdir(), "pdf-migrator-outside-"));
      const escapePath = join(escapeDir, "victim.pdf");
      await writeFile(escapePath, "precious");
      const escapeStat = await lstat(escapePath);
      const fixture = await seedSource(root, JOB_A, "%PDF-a");
      const record = await seedRecord(root, fixture, "committed");
      await writeFile(
        recordPathFor(recordsDirFor(root), JOB_A),
        `${JSON.stringify({
          ...record,
          destination: { name: "victim.pdf", path: escapePath },
          source: {
            ...record.source,
            dev: String(escapeStat.dev),
            ino: String(escapeStat.ino),
          },
          sha256: sha256("precious"),
        })}\n`,
      );
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
      expect(rowEvents(events)[0]?.detail).toContain("record-mismatch");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(await readFile(escapePath, "utf8")).toBe("precious");
      await rm(escapeDir, { recursive: true, force: true });
    });

    it("reports a corrupt record as an anomaly and unlinks valid ones", async () => {
      await applied([
        [JOB_A, "%PDF-a"],
        [JOB_B, "%PDF-b"],
      ]);
      await writeFile(recordPathFor(recordsDirFor(root), JOB_B), "not-json\n");
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      const verdicts = rowEvents(events).map((event) => event.verdict);
      expect(verdicts).toContain("removed");
      expect(verdicts).toContain("skipped-anomaly");
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      // The corrupt record's link is preserved.
      expect((await lstat(join(root, `${JOB_B}-g1.pdf`))).isFile()).toBe(true);
    });

    it("treats a symlinked record as an anomaly", async () => {
      await applied([[JOB_A, "%PDF-a"]]);
      const recordPath = recordPathFor(recordsDirFor(root), JOB_A);
      const real = join(root, "elsewhere.json");
      await rm(recordPath);
      await writeFile(real, `${JSON.stringify({ jobId: JOB_A })}\n`);
      await symlink(real, recordPath);
      const { outcome, events } = await run(root, "rollback", [], CONFIRM);
      expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
      expect(rowEvents(events)[0]?.detail).toContain("record-symlink");
      expect((await lstat(join(root, `${JOB_A}-g1.pdf`))).isFile()).toBe(true);
    });
  });
});
