import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { configureRate, pace, settleRate } from "./rate.ts";

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    readFileSync: vi.fn(real.readFileSync),
    rmSync: vi.fn(real.rmSync),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

const total = (file: string): number =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .reduce((sum, line) => sum + Number(line.split(" ")[1]), 0);

describe("request ledger", () => {
  // Root and non-POSIX contexts cannot establish this real permission boundary.
  it.skipIf(process.getuid === undefined || process.getuid() === 0)(
    "does not reserve when existing history is unreadable but writable",
    () => {
      const output = join(import.meta.dirname, "../../output/crawl-rate-tests");
      mkdirSync(output, { recursive: true });
      const dir = mkdtempSync(join(output, "permission-"));
      const file = join(dir, "ledger.log");
      const history = `${Date.now()} 4\n`;
      writeFileSync(file, history);
      chmodSync(file, 0o200);
      try {
        expect(() => readFileSync(file, "utf8")).toThrow(
          expect.objectContaining({ code: "EACCES" }),
        );
        configureRate("unreadable-history", file, 5);
        expect(() => pace("unreadable-history", 1)).toThrow(
          expect.objectContaining({ code: "EACCES" }),
        );
        chmodSync(file, 0o600);
        expect(readFileSync(file, "utf8")).toBe(history);
      } finally {
        chmodSync(file, 0o600);
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it("reserves up to the cap and trues a reservation up to the real count", () => {
    const file = join(mkdtempSync(join(tmpdir(), "rate-")), "ledger.log");
    configureRate("t", file, 5);
    const at = pace("t", 3);
    pace("t", 2);
    expect(total(file)).toBe(5);
    settleRate("t", at, 3, 1);
    expect(total(file)).toBe(3);
  });
});

// pace waits forever on contention, so lock errors run in a child with an
// external deadline: on a defect the child is killed, not failed by message.
const CHILD = `const { configureRate, pace } = await import(process.env.RATE_MODULE);
configureRate('x', process.env.RATE_LEDGER, 5);
try {
  pace('x', 1);
  console.log('RESERVED');
} catch (error) {
  console.log(
    'ERR:' +
      (Array.isArray(error?.errors)
        ? error.errors.map((entry) => entry?.code).join('+')
        : (error?.code ?? String(error))),
  );
}`;

function runLedger(file: string): string {
  return execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", CHILD],
    {
      encoding: "utf8",
      timeout: 8000,
      env: {
        ...process.env,
        RATE_MODULE: pathToFileURL(join(import.meta.dirname, "rate.ts")).href,
        RATE_LEDGER: file,
      },
    },
  );
}

describe("lock failures", () => {
  it("surfaces a permanent lock acquisition failure instead of retrying forever", () => {
    const dir = mkdtempSync(join(tmpdir(), "rate-lock-"));
    try {
      const blocker = join(dir, "blocker");
      writeFileSync(blocker, "");
      expect(runLedger(join(blocker, "ledger.log"))).toContain("ENOTDIR");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.getuid === undefined || process.getuid() === 0)(
    "surfaces a stale-lock removal failure instead of hiding it",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "rate-stale-"));
      const file = join(dir, "ledger.log");
      try {
        mkdirSync(`${file}.lock`);
        const past = new Date(Date.now() - 60_000);
        utimesSync(`${file}.lock`, past, past);
        chmodSync(dir, 0o555);
        expect(runLedger(file)).toContain("EACCES");
      } finally {
        chmodSync(dir, 0o700);
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it("keeps the action failure first when the lock release also fails", () => {
    const file = join(
      mkdtempSync(join(tmpdir(), "rate-release-")),
      "ledger.log",
    );
    configureRate("double-failure", file, 5);
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw Object.assign(new Error("action denied"), { code: "EACCES" });
    });
    vi.mocked(rmSync).mockImplementationOnce(() => {
      throw Object.assign(new Error("release denied"), { code: "EPERM" });
    });
    let caught: unknown;
    try {
      pace("double-failure", 1);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    expect(
      (caught as AggregateError).errors.map(
        (error) => (error as NodeJS.ErrnoException).code,
      ),
    ).toEqual(["EACCES", "EPERM"]);
  });

  it("fails when the lock cannot be released after a successful action", () => {
    const file = join(
      mkdtempSync(join(tmpdir(), "rate-release-")),
      "ledger.log",
    );
    configureRate("release-failure", file, 5);
    vi.mocked(rmSync).mockImplementationOnce(() => {
      throw Object.assign(new Error("release denied"), { code: "EPERM" });
    });
    expect(() => pace("release-failure", 1)).toThrow(
      expect.objectContaining({ code: "EPERM" }),
    );
  });
});
