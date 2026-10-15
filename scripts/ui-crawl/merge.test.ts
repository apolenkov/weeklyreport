import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { mergeReports } from "./merge.ts";

const root = join(import.meta.dirname, "../../output/crawl-merge-tests");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function walkDir(): string {
  mkdirSync(root, { recursive: true });
  const walk = mkdtempSync(join(root, "walk-"));
  dirs.push(walk);
  return walk;
}

function pass(walk: string, dir: string, report: string | null): void {
  mkdirSync(join(walk, dir), { recursive: true });
  if (report !== null) writeFileSync(join(walk, dir, "report.json"), report);
}

describe("mergeReports", () => {
  it("lists passes without a usable report and carries their missing roles", () => {
    mkdirSync(root, { recursive: true });
    const walk = mkdtempSync(join(root, "walk-"));
    dirs.push(walk);
    pass(
      walk,
      "state-draft/read",
      JSON.stringify({
        url: "http://127.0.0.1:3000",
        started: "fixture",
        wallMs: 5,
        results: [{ role: "lead", ms: 5, runs: [] }],
        missing: [{ role: "head", reason: "invalid JSON" }],
      }),
    );
    pass(walk, "state-draft/synthetic", null);
    pass(walk, "state-published/read", '{"url":');

    const merged = mergeReports(walk);

    const missing = [
      { role: "state-draft/read/head", reason: "invalid JSON" },
      { role: "state-draft/synthetic", reason: "no report.json" },
      { role: "state-published/read", reason: "invalid report.json" },
    ];
    expect(merged).toEqual({ passes: 1, missing });
    const json = JSON.parse(
      readFileSync(join(walk, "report.json"), "utf8"),
    ) as {
      missing: unknown;
      results: readonly { role: string }[];
    };
    expect(json.missing).toEqual(missing);
    expect(json.results.map((r) => r.role)).toEqual(["lead"]);
    const markdown = readFileSync(join(walk, "report.md"), "utf8");
    expect(markdown).toContain(
      "**Incomplete report: 3 expected output(s) missing.**",
    );
    expect(markdown).toContain(
      String.raw`- state\-draft/synthetic: no report\.json`,
    );
    // Raw pass output stays as found.
    expect(
      readFileSync(join(walk, "state-published/read/report.json"), "utf8"),
    ).toBe('{"url":');
    expect(existsSync(join(walk, "state-draft/synthetic"))).toBe(true);
  });

  it.each([
    ['{"results":{}}'],
    ['{"results":[{}]}'],
    ['{"results":[{"role":"lead","ms":1,"runs":[]}],"missing":{}}'],
    ['{"results":[{"role":"lead","ms":1,"runs":[]}],"missing":[1]}'],
    ['{"results":[],"missing":[{"role":"viewer"}]}'],
    ["null"],
  ])("names a pass report of the wrong shape: %s", (report) => {
    const walk = walkDir();
    pass(walk, "state-draft/read", report);

    expect(mergeReports(walk)).toEqual({
      passes: 0,
      missing: [{ role: "state-draft/read", reason: "not a crawl report" }],
    });
  });

  it("exits non-zero from the command line when an output is missing", () => {
    const walk = walkDir();
    pass(walk, "state-draft/read", null);

    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        join(import.meta.dirname, "merge.ts"),
        walk,
      ],
      { encoding: "utf8", timeout: 30_000 },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Incomplete full walk: 1 expected output(s) missing",
    );
  });
});
