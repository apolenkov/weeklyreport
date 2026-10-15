import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../output/crawl-parent-tests");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("crawl parent run", () => {
  it("lists a role whose process left no output and exits non-zero", () => {
    mkdirSync(root, { recursive: true });
    const out = mkdtempSync(join(root, "run-"));
    dirs.push(out);
    // No secrets file and no PW_* variables: the role process fails before any browser starts.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("PW_")),
    );

    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        join(import.meta.dirname, "crawl.ts"),
        ...["--quick", "--roles", "viewer", "--no-video"],
        ...["--url", "http://127.0.0.1:9", "--out", out],
        ...["--secrets", join(out, "absent-secrets.env")],
      ],
      { encoding: "utf8", env, timeout: 60_000 },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("1 missing role output(s)");
    const report = JSON.parse(
      readFileSync(join(out, "report.json"), "utf8"),
    ) as { missing: unknown; results: unknown };
    expect(report.missing).toEqual([{ role: "viewer", reason: "no output" }]);
    expect(report.results).toEqual([]);
    expect(readFileSync(join(out, "report.md"), "utf8")).toContain(
      "**Incomplete report: 1 expected output(s) missing.**",
    );
  });
});
