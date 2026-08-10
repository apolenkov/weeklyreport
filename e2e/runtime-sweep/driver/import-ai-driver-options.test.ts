import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseImportOptions } from "./import-ai-driver-options.ts";

const baseArgs = [
  "--cells",
  "cells.json",
  "--output",
  "output",
  "--source-sha",
  "a".repeat(40),
  "--profile",
  "minimal",
  "--role",
  "lead",
] as const;

describe("native AI driver import options", () => {
  it("requires one explicit transcript per report", () => {
    const options = parseImportOptions([
      "--report",
      "first.json",
      "--transcript",
      "first.jsonl",
      "--report",
      "second.json",
      "--transcript",
      "second.jsonl",
      ...baseArgs,
    ]);

    expect(options.reportPaths).toEqual([
      path.resolve("first.json"),
      path.resolve("second.json"),
    ]);
    expect(options.transcriptPaths).toEqual([
      path.resolve("first.jsonl"),
      path.resolve("second.jsonl"),
    ]);
  });

  it("rejects a missing or mismatched transcript list", () => {
    expect(() =>
      parseImportOptions(["--report", "report.json", ...baseArgs]),
    ).toThrow(/transcript is required/iu);
    expect(() =>
      parseImportOptions([
        "--report",
        "first.json",
        "--report",
        "second.json",
        "--transcript",
        "only.jsonl",
        ...baseArgs,
      ]),
    ).toThrow(/one --transcript is required for each --report/iu);
  });
});
