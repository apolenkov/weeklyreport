import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

import type { ReactDoctorBaselineEntry } from "./react-doctor-baseline.ts";
import {
  compareReactDoctorBaseline,
  reactDoctorBaselineIsCurrent,
} from "./react-doctor-baseline.ts";

const accepted: ReactDoctorBaselineEntry = {
  id: "src/example.tsx::1:1::react-doctor/example::digest",
  file: "src/example.tsx",
  rule: "example",
  verdict: "overturn",
  rationale: "The repository contract makes this diagnostic inapplicable.",
};

void test("accepts an exact terminal baseline", () => {
  const diff = compareReactDoctorBaseline([accepted], [accepted]);
  assert.equal(reactDoctorBaselineIsCurrent(diff), true);
});

interface RuntimeReport {
  readonly diagnostics: readonly { readonly filePath: string }[];
  readonly projects: readonly {
    readonly analyzedFiles: readonly string[];
  }[];
}

void test("excludes the scenario sweep build from a real full scan", () => {
  const fixture = join(
    "apps/web/.next-sweep/react-doctor-regression-fixture",
    "untrusted-redirect.js",
  );
  const pnpmExecPath = process.env.npm_execpath;
  if (pnpmExecPath === undefined) {
    throw new Error("npm_execpath is unset; run this test through pnpm");
  }
  const [command, leadingArguments] = /\.[cm]?js$/u.test(pnpmExecPath)
    ? [process.execPath, [pnpmExecPath]]
    : [pnpmExecPath, []];

  try {
    mkdirSync(dirname(fixture), { recursive: true });
    writeFileSync(
      fixture,
      'const target = new URLSearchParams(location.search).get("redirect");\nif (target) location.assign(target);\n',
    );
    const output = execFileSync(
      command,
      [
        ...leadingArguments,
        "--filter",
        "@customreport/web",
        "exec",
        "react-doctor",
        ".",
        "--scope",
        "full",
        "--json",
        "--json-compact",
        "--no-telemetry",
        "--no-parallel",
        "--max-duration",
        "300",
        "--blocking",
        "error",
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    const report = JSON.parse(output) as RuntimeReport;
    const analyzedSweepBuild = report.projects
      .flatMap(({ analyzedFiles }) => analyzedFiles)
      .some((file) => file.includes(".next-sweep"));
    assert.equal(analyzedSweepBuild, false);
    assert.equal(
      report.diagnostics.some(({ filePath }) =>
        filePath.includes(".next-sweep"),
      ),
      false,
    );
  } finally {
    rmSync(dirname(fixture), { recursive: true, force: true });
  }
});

void test("rejects added, removed, duplicate, drifted, and unjustified entries", () => {
  const invalid = { ...accepted, rationale: "" };
  const changed = { ...accepted, file: "src/changed.tsx" };
  const added = {
    id: "src/new.tsx::1:1::react-doctor/new::digest",
    file: "src/new.tsx",
    rule: "new",
  };
  const diff = compareReactDoctorBaseline(
    [invalid, invalid, { ...accepted, id: "removed" }],
    [changed, changed, added],
  );

  assert.deepEqual(diff.duplicateBaselineIds, [accepted.id]);
  assert.deepEqual(diff.duplicateCurrentIds, [accepted.id]);
  assert.deepEqual(diff.added, [added]);
  assert.deepEqual(
    diff.removed.map(({ id }) => id),
    ["removed"],
  );
  assert.deepEqual(diff.metadataDrift, [changed, changed]);
  assert.equal(diff.invalidEntries.length, 2);
  assert.equal(reactDoctorBaselineIsCurrent(diff), false);
});
