import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

import { withoutLocalGitEnvironment } from "../../shared/git-environment.ts";
import type { ReactDoctorBaselineEntry } from "./react-doctor-baseline.ts";
import {
  assertReactDoctorScanComplete,
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
  readonly reactDetected: boolean;
  readonly projects: readonly {
    readonly complete: boolean;
    readonly directory: string;
    readonly skippedChecks: readonly string[];
  }[];
}

void test("rejects vacuous or incomplete project scans", () => {
  const validProject = {
    complete: true,
    skippedChecks: [] as readonly string[],
  };

  assert.doesNotThrow(() =>
    assertReactDoctorScanComplete(true, [validProject]),
  );
  assert.throws(
    () => assertReactDoctorScanComplete(false, [validProject]),
    /did not detect React/,
  );
  assert.throws(
    () => assertReactDoctorScanComplete(true, []),
    /no project scans/,
  );
  assert.throws(
    () =>
      assertReactDoctorScanComplete(true, [
        { ...validProject, complete: false },
      ]),
    /did not complete/,
  );
  assert.throws(
    () =>
      assertReactDoctorScanComplete(true, [
        { ...validProject, skippedChecks: ["eslint"] },
      ]),
    /skipped checks: eslint/,
  );
});

void test("filters generated sweep builds from real full-scan diagnostics", () => {
  const fixtures = [
    "apps/web/.next-sweep/react-doctor-regression-fixture",
    "apps/web/.next-runtime-preflight-probe/react-doctor-regression-fixture",
  ].map((directory) => join(directory, "untrusted-redirect.js"));
  const pnpmExecPath = process.env.npm_execpath;
  if (pnpmExecPath === undefined) {
    throw new Error("npm_execpath is unset; run this test through pnpm");
  }
  const [command, leadingArguments] = /\.[cm]?js$/u.test(pnpmExecPath)
    ? [process.execPath, [pnpmExecPath]]
    : [pnpmExecPath, []];

  try {
    fixtures.forEach((fixture) => {
      mkdirSync(dirname(fixture), { recursive: true });
      writeFileSync(
        fixture,
        'const target = new URLSearchParams(location.search).get("redirect");\nif (target) location.assign(target);\n',
      );
    });
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
      {
        encoding: "utf8",
        env: withoutLocalGitEnvironment({
          ...process.env,
          GIT_DIR: join(process.cwd(), ".git"),
          GIT_INDEX_FILE: join(process.cwd(), ".git", "index"),
          GIT_PREFIX: "poisoned-prefix",
          GIT_WORK_TREE: process.cwd(),
        }),
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    const report = JSON.parse(output) as RuntimeReport;
    const [project] = report.projects;
    assert.ok(project);
    assert.equal(report.reactDetected, true);
    assert.equal(project.complete, true);
    assert.equal(project.directory, join(process.cwd(), "apps/web"));
    assert.deepEqual(project.skippedChecks, []);
    assert.equal(
      report.diagnostics.some(
        ({ filePath }) =>
          filePath.includes(".next-sweep") ||
          filePath.includes(".next-runtime-") ||
          filePath.includes("apps/web/openspec"),
      ),
      false,
    );

    const gateOutput = execFileSync(
      command,
      [...leadingArguments, "run", "--silent", "lint:react-doctor"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_DIR: join(process.cwd(), ".git"),
          GIT_INDEX_FILE: join(process.cwd(), ".git", "index"),
          GIT_PREFIX: "poisoned-prefix",
          GIT_WORK_TREE: process.cwd(),
        },
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    assert.match(
      gateOutput,
      /react-doctor PASS 0 errors, \d+ reviewed warnings/,
    );
  } finally {
    fixtures.forEach((fixture) => {
      rmSync(dirname(fixture), { recursive: true, force: true });
    });
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
