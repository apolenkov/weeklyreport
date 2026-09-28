import { createHash, randomUUID } from "node:crypto";
import type { BigIntStats, Stats } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXIT_UNRESOLVED, type MigratorEvent } from "./report.js";
import { runRollback } from "./rollback.js";
import type { JobRecord } from "./state.js";
import {
  probeLinkAgainstRecord,
  readRecord,
  recordPathFor,
  recordsDirFor,
  writeRecord,
} from "./state.js";

// A foreign file's real inode can exceed 2^53, where a numeric fs.stat loses
// the exact value. The mock below arms a single path with stats carrying a
// chosen true inode: asked without { bigint: true } it answers the rounded
// double the kernel value would collapse to — exactly what real lstat does.
const fsControl = vi.hoisted(() => ({
  fakeLstat: undefined as
    | {
        readonly path: string;
        readonly stats: (bigintMode: boolean) => Stats | BigIntStats;
      }
    | undefined,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const lstatMock = (async (path: unknown, options?: unknown) => {
    const fake = fsControl.fakeLstat;
    if (String(path) === fake?.path) {
      return fake.stats(
        (options as { bigint?: boolean } | undefined)?.bigint === true,
      );
    }
    return (actual.lstat as (p: unknown, o?: unknown) => Promise<unknown>)(
      path,
      options,
    );
  }) as typeof actual.lstat;
  return { ...actual, lstat: lstatMock };
});

const JOB_A = "a0000000-0000-4000-a000-000000000400";
const TWO_POW_53 = 2n ** 53n; // 9007199254740992
// 2^53 + 1 = 9007199254740993: not representable as a double — Number()
// rounds it down onto 2^53.
const FOREIGN_INO = TWO_POW_53 + 1n;

const rowEvents = (events: MigratorEvent[]) =>
  events.flatMap((event) => (event.type === "row" ? [event] : []));

describe("inode identity precision", () => {
  let root = "";
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "pdf-inode-"));
  });
  afterEach(async () => {
    fsControl.fakeLstat = undefined;
    await rm(root, { recursive: true, force: true });
  });

  it("refuses a same-content foreign link whose true inode differs past 2^53", async () => {
    const bytes = "%PDF-a";
    const sourcePath = join(root, `${JOB_A}.pdf`);
    const destPath = join(root, `${JOB_A}-g1.pdf`);
    await writeFile(sourcePath, bytes);
    // A foreign same-content replacement sits at the recorded destination.
    await writeFile(destPath, bytes);
    const foreignStat = await lstat(destPath);

    // The record was written for a source whose inode is exactly 2^53.
    const record: JobRecord = {
      version: 1,
      operation: randomUUID(),
      jobId: JOB_A,
      source: {
        name: `${JOB_A}.pdf`,
        path: sourcePath,
        dev: String(foreignStat.dev),
        ino: String(TWO_POW_53),
      },
      destination: { name: `${JOB_A}-g1.pdf`, path: destPath },
      sha256: createHash("sha256").update(bytes).digest("hex"),
      state: "committed",
    };
    const recordsDir = recordsDirFor(root);
    await mkdir(recordsDir, { recursive: true });
    await writeRecord(recordsDir, record);

    // The foreign file's true inode is 2^53+1 — a numeric stat rounds it
    // onto the recorded inode, a bigint stat keeps the distinction.
    fsControl.fakeLstat = {
      path: destPath,
      stats: (bigintMode) => {
        const fake = Object.create(
          Object.getPrototypeOf(foreignStat) as object,
        ) as Stats;
        return Object.assign(fake, foreignStat, {
          dev: bigintMode ? BigInt(foreignStat.dev) : foreignStat.dev,
          ino: bigintMode ? FOREIGN_INO : Number(FOREIGN_INO),
        });
      },
    };

    expect(await probeLinkAgainstRecord(destPath, record)).toBe("mismatch");

    const events: MigratorEvent[] = [];
    const outcome = await runRollback(root, (event) => {
      events.push(event);
    });
    expect(outcome.exitCode).toBe(EXIT_UNRESOLVED);
    expect(rowEvents(events)[0]?.verdict).toBe("skipped-anomaly");
    expect(rowEvents(events)[0]?.detail).toContain(
      "record-committed-dest-mismatch",
    );
    // The foreign file and the committed record survive untouched.
    expect(await readFile(destPath, "utf8")).toBe(bytes);
    const persisted = await readRecord(
      recordPathFor(recordsDirFor(root), JOB_A),
    );
    expect(persisted).toMatchObject({
      kind: "ok",
      record: { state: "committed" },
    });
  });
});
