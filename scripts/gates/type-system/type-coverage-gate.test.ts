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

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TYPE_COVERAGE_ENTRY = join(
  REPO_ROOT,
  "node_modules/type-coverage/dist/index.js",
);

const EXPECTED_THRESHOLDS = [
  { project: "packages/shared", threshold: 100 },
  { project: "packages/ui", threshold: 100 },
  { project: "apps/api", threshold: 99.98 },
  {
    ignoreFiles: "apps/web/.next/**",
    project: "apps/web",
    threshold: 99.8,
  },
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

const runProjectTypeCoverage = (directory: string, ignoreFiles?: string) => {
  const ignoreArguments = ignoreFiles ? ["--ignore-files", ignoreFiles] : [];
  const result = spawnSync(
    process.execPath,
    [
      TYPE_COVERAGE_ENTRY,
      "-p",
      "apps/web",
      "--at-least",
      "100",
      ...ignoreArguments,
    ],
    { cwd: directory, encoding: "utf8" },
  );
  assert.equal(result.error, undefined);
  return result;
};

void test("the canonical type-coverage command keeps package thresholds", () => {
  const expected = EXPECTED_THRESHOLDS.map(
    ({ project, threshold, ...entry }) => {
      const ignoreArgument =
        "ignoreFiles" in entry ? ` --ignore-files '${entry.ignoreFiles}'` : "";
      return `type-coverage -p ${project} --at-least ${threshold}${ignoreArgument}`;
    },
  ).join(" && ");
  assert.equal(canonicalTypeCoverageCommand(), expected);
});

void test("generated Next.js types stay outside the product threshold", () => {
  const directory = mkdtempSync(join(tmpdir(), "customreport-typecov-next-"));
  const projectDirectory = join(directory, "apps/web");
  const sourceDirectory = join(projectDirectory, "src");
  const generatedDirectory = join(projectDirectory, ".next/types");
  mkdirSync(sourceDirectory, { recursive: true });
  mkdirSync(generatedDirectory, { recursive: true });
  writeFileSync(
    join(projectDirectory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true },
      include: ["src/**/*.ts", ".next/types/**/*.ts"],
    }),
  );
  writeFileSync(
    join(sourceDirectory, "control.ts"),
    "export const value = 1;\n",
  );
  writeFileSync(
    join(generatedDirectory, "generated.ts"),
    'export const generated: any = "framework-owned";\n',
  );

  try {
    const withoutIgnore = runProjectTypeCoverage(directory);
    assert.notEqual(withoutIgnore.status, 0);

    const withIgnore = runProjectTypeCoverage(directory, "apps/web/.next/**");
    assert.equal(withIgnore.status, 0, withIgnore.stdout + withIgnore.stderr);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
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
