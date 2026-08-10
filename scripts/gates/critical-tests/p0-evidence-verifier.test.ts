import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseManifest } from "./p0-evidence-model.ts";
import {
  commandDigest,
  EXPECTED_P0_IDS,
  verifyP0Evidence,
} from "./p0-evidence-verifier.ts";

const COMMAND = "pnpm test:p0";
const TEST_PATH = "critical.test.ts";

function finding(id: string, index: number) {
  return {
    id,
    resolved: true,
    owner: `owner-${index}`,
    implementation: "implementation.ts",
    spec: "spec.md",
    tests: [{ path: TEST_PATH, needle: "executable contract" }],
    probes: [{ path: TEST_PATH, needle: "planted negative" }],
    commands: [COMMAND],
  };
}

function manifest() {
  return {
    version: 1,
    expectedIds: [...EXPECTED_P0_IDS],
    findings: EXPECTED_P0_IDS.map(finding),
  };
}

function workspace(
  source = 'test("executable contract", () => {}); // planted negative',
) {
  const root = mkdtempSync(join(tmpdir(), "p0-evidence-"));
  const manifestPath = join(root, "manifest.json");
  const resultsPath = join(root, "results.json");
  writeFileSync(
    join(root, "implementation.ts"),
    "export const fixed = true;\n",
  );
  writeFileSync(join(root, "spec.md"), "# Contract\n");
  writeFileSync(join(root, TEST_PATH), source);
  return { root, manifestPath, resultsPath };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function passingResults(
  root: string,
  manifestValue: ReturnType<typeof manifest>,
) {
  const parsed = parseManifest(manifestValue);
  return {
    version: 2,
    generatedAt: "2026-08-01T00:00:00.000Z",
    commands: [
      {
        command: COMMAND,
        exitCode: 0,
        sourceDigest: commandDigest(root, parsed, COMMAND),
        summary: "13 executable fixtures passed",
      },
    ],
  };
}

void test("accepts exactly thirteen resolved findings with current passing evidence", () => {
  const paths = workspace();
  const value = manifest();
  writeJson(paths.manifestPath, value);
  writeJson(paths.resultsPath, passingResults(paths.root, value));

  assert.deepEqual(verifyP0Evidence({ ...paths }), []);
});

void test("rejects missing and duplicate ids, owners, paths, and probes", () => {
  const paths = workspace();
  const value = manifest();
  const [first, second, ...rest] = value.findings;
  assert.ok(first && second);
  writeJson(paths.manifestPath, {
    ...value,
    expectedIds: value.expectedIds.slice(1),
    findings: [
      { ...first, resolved: false, owner: second.owner },
      {
        ...second,
        id: first.id,
        implementation: "missing.ts",
        probes: [{ path: "unowned.test.ts", needle: "absent" }],
      },
      ...rest,
    ],
  });

  const errors = verifyP0Evidence({ ...paths, markersOnly: true });
  assert.ok(errors.some((error) => error.includes("expectedIds is missing")));
  assert.ok(errors.some((error) => error.includes("findings duplicates")));
  assert.ok(errors.some((error) => error.includes("duplicate owner")));
  assert.ok(errors.some((error) => error.includes("is unresolved")));
  assert.ok(errors.some((error) => error.includes("missing file missing.ts")));
  assert.ok(errors.some((error) => error.includes("probe is not owned")));
});

void test("rejects advisory tests and missing evidence needles", () => {
  const paths = workspace(
    'test.skip("executable contract", () => {}); // no planted proof',
  );
  const value = manifest();
  writeJson(paths.manifestPath, value);

  const errors = verifyP0Evidence({ ...paths, markersOnly: true });
  assert.ok(
    errors.some((error) => error.includes("advisory test marker .skip")),
  );
  assert.ok(
    errors.some((error) => error.includes("lacks evidence: planted negative")),
  );
});

void test("rejects absent, failed, and stale command evidence", () => {
  const paths = workspace();
  const value = manifest();
  writeJson(paths.manifestPath, value);
  writeJson(paths.resultsPath, {
    version: 2,
    generatedAt: "2026-08-01T00:00:00.000Z",
    commands: [],
  });
  assert.ok(
    verifyP0Evidence({ ...paths }).some((error) =>
      error.includes("missing passing evidence"),
    ),
  );

  const passing = passingResults(paths.root, value);
  writeJson(paths.resultsPath, {
    ...passing,
    commands: passing.commands.map((entry) => ({ ...entry, exitCode: 1 })),
  });
  assert.ok(
    verifyP0Evidence({ ...paths }).some((error) =>
      error.includes("command exited with code 1"),
    ),
  );

  writeJson(paths.resultsPath, passing);
  writeFileSync(
    join(paths.root, "implementation.ts"),
    "export const fixed = false;\n",
  );
  assert.ok(
    verifyP0Evidence({ ...paths }).some((error) =>
      error.includes("stale source digest"),
    ),
  );
});

void test("rejects a claimed pass when the captured command exited nonzero", () => {
  const paths = workspace();
  const value = manifest();
  writeJson(paths.manifestPath, value);
  const passing = passingResults(paths.root, value);
  writeJson(paths.resultsPath, {
    ...passing,
    commands: passing.commands.map((entry) => ({
      ...entry,
      passed: true,
      exitCode: 1,
      summary: "RERUN FAILED with exit 1",
    })),
  });

  assert.ok(
    verifyP0Evidence({ ...paths }).some((error) =>
      error.includes("command exited with code 1"),
    ),
  );
});
