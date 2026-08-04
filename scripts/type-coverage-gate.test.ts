import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPE_COVERAGE_ENTRY = join(
  REPO_ROOT,
  "node_modules/type-coverage/dist/index.js",
);

const EXPECTED_THRESHOLDS = [
  { project: "packages/shared", threshold: 100 },
  { project: "packages/ui", threshold: 100 },
  { project: "apps/api", threshold: 99.98 },
  { project: "apps/web", threshold: 99.8 },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const canonicalTypeCoverageCommand = (): string => {
  const parsed: unknown = JSON.parse(
    readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
  );
  if (!isRecord(parsed)) throw new Error("package.json must contain an object");
  const scripts = parsed.scripts;
  if (!isRecord(scripts))
    throw new Error("package.json scripts must be an object");
  const command = scripts.typecov;
  if (typeof command !== "string")
    throw new Error("package.json typecov script must be a string");
  return command;
};

const runTypeCoverage = (
  directory: string,
  threshold: number,
  file: string,
) => {
  const result = spawnSync(
    process.execPath,
    [
      TYPE_COVERAGE_ENTRY,
      "-p",
      ".",
      "--at-least",
      String(threshold),
      "--",
      file,
    ],
    { cwd: directory, encoding: "utf8" },
  );
  assert.equal(result.error, undefined);
  return result;
};

void test("the canonical type-coverage command keeps package thresholds", () => {
  const expected = EXPECTED_THRESHOLDS.map(
    ({ project, threshold }) =>
      `type-coverage -p ${project} --at-least ${threshold}`,
  ).join(" && ");
  assert.equal(canonicalTypeCoverageCommand(), expected);
});

void test("each threshold rejects a planted escape but accepts typed control", () => {
  const directory = mkdtempSync(join(tmpdir(), "customreport-typecov-gate-"));
  const sourceDirectory = join(directory, "src");
  mkdirSync(sourceDirectory);
  writeFileSync(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        skipLibCheck: true,
        strict: true,
        target: "ES2022",
      },
      include: ["src/**/*.ts"],
    }),
  );
  writeFileSync(
    join(sourceDirectory, "control.ts"),
    'const typedControl: string = "typed";\nvoid typedControl;\n',
  );
  writeFileSync(
    join(sourceDirectory, "escape.ts"),
    'const escapedValue: any = "untyped";\nvoid escapedValue;\n',
  );

  try {
    for (const { threshold } of EXPECTED_THRESHOLDS) {
      const control = runTypeCoverage(directory, threshold, "src/control.ts");
      assert.equal(control.status, 0, control.stdout + control.stderr);

      const escape = runTypeCoverage(directory, threshold, "src/escape.ts");
      assert.notEqual(escape.status, 0, escape.stdout + escape.stderr);
      assert.match(`${escape.stdout}${escape.stderr}`, /escapedValue/u);
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
