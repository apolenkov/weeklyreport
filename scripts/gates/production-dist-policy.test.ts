import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "vitest";

import {
  checksApiRuntime,
  hasBareInternalPackageImport,
  isProductionDistMode,
} from "./production-dist-policy.js";

test("production dist policy recognizes only current build modes", () => {
  assert.equal(isProductionDistMode("--all"), true);
  assert.equal(isProductionDistMode("--api"), true);
  assert.equal(isProductionDistMode("--shared"), true);
  assert.equal(isProductionDistMode("--persistence"), false);
});

const apiEntrypoints = [
  "apps/api/dist/apps/api/src/main.js",
  "apps/api/dist/packages/shared/src/index.js",
  "apps/api/dist/packages/report-persistence/src/index.js",
];
const sharedEntrypoint = "packages/shared/dist/index.js";
const typescriptPackageRoot = dirname(
  dirname(fileURLToPath(import.meta.resolve("typescript"))),
);

const scenarios = [
  { name: "empty API", mode: "--api", files: [], status: 1 },
  { name: "empty shared", mode: "--shared", files: [], status: 1 },
  { name: "empty combined", mode: "--all", files: [], status: 1 },
  ...apiEntrypoints.map((missing) => ({
    name: `API missing ${missing}`,
    mode: "--api",
    files: apiEntrypoints.filter((path) => path !== missing),
    status: 1,
  })),
  {
    name: "combined missing shared build",
    mode: "--all",
    files: apiEntrypoints,
    status: 1,
  },
  { name: "complete API", mode: "--api", files: apiEntrypoints, status: 0 },
  {
    name: "complete shared",
    mode: "--shared",
    files: [sharedEntrypoint],
    status: 0,
  },
  {
    name: "complete combined",
    mode: "--all",
    files: [...apiEntrypoints, sharedEntrypoint],
    status: 0,
  },
];
for (const scenario of scenarios) {
  test(`production dist CLI requires runnable build entrypoints: ${scenario.name}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "weeklyreport-dist-fixture-"));
    try {
      await mkdir(join(root, "scripts/gates"), { recursive: true });
      for (const name of ["production-dist.ts", "production-dist-policy.ts"]) {
        await copyFile(
          join(import.meta.dirname, name),
          join(root, "scripts/gates", name),
        );
      }
      await writeFile(join(root, "package.json"), '{"type":"module"}');
      await mkdir(join(root, "node_modules"));
      await symlink(
        typescriptPackageRoot,
        join(root, "node_modules/typescript"),
        "dir",
      );
      for (const path of ["apps/api/dist", "packages/shared/dist"]) {
        await mkdir(join(root, path), { recursive: true });
      }
      for (const path of scenario.files) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await writeFile(join(root, path), "export {};\n");
      }

      const result = spawnSync(
        process.execPath,
        [
          "--import",
          import.meta.resolve("tsx"),
          join(root, "scripts/gates/production-dist.ts"),
          scenario.mode,
        ],
        { cwd: root, encoding: "utf8" },
      );
      assert.equal(result.status, scenario.status, result.stderr);
      if (scenario.status === 1) {
        assert.match(result.stderr, /Missing production entrypoints:/u);
      } else {
        assert.match(result.stdout, /Production dist gate passed/u);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("all and API modes inspect the embedded API runtime", () => {
  assert.equal(checksApiRuntime("--all"), true);
  assert.equal(checksApiRuntime("--api"), true);
  assert.equal(checksApiRuntime("--shared"), false);
});

test("bare workspace imports cannot remain in the API runtime", () => {
  for (const source of [
    "import '@weeklyreport/shared';",
    "import value from '@weeklyreport/shared/schema';",
    "export * from '@weeklyreport/report-persistence';",
    "export { value } from '@weeklyreport/report-persistence/runtime';",
    "import('@weeklyreport/shared')",
    "import('@weeklyreport/shared/schema.json', { with: { type: 'json' } })",
    "import(`@weeklyreport/report-persistence/runtime`)",
  ]) {
    assert.equal(hasBareInternalPackageImport(source), true, source);
  }

  for (const source of [
    "import '../packages/report-persistence/src/index.js';",
    "import '@weeklyreport/shared-extra';",
    "const message = \"import '@weeklyreport/shared'\";",
    "// import '@weeklyreport/shared';",
    "const packageName = '@weeklyreport/shared'; import(packageName);",
    "import(`@weeklyreport/$" + "{packageName}`);",
  ]) {
    assert.equal(hasBareInternalPackageImport(source), false, source);
  }
});
