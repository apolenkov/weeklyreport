import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { configureRate, pace, settleRate } from "./rate.ts";

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
