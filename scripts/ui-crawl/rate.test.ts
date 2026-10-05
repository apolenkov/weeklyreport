import { mkdtempSync, readFileSync } from "node:fs";
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
