import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { afterEach } from "node:test";

const script = resolve("scripts/gates/production-deps-prune.ts");
const fixtureRoots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function makeDeployRoot(name = "@customreport/api"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "weeklyreport-prune-fixture-"));
  fixtureRoots.add(root);
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name, private: name === "@customreport/api" }),
  );
  await mkdir(join(root, "node_modules", ".pnpm", "node_modules"), {
    recursive: true,
  });
  await writeFile(join(root, "node_modules", ".modules.yaml"), "fixture\n");
  await writeFile(join(root, "node_modules", ".package-map.json"), "{}\n");
  return root;
}

async function makePackage(
  root: string,
  entry: string,
  name: string,
): Promise<string> {
  const packageRoot = join(root, "node_modules", ".pnpm", entry);
  await mkdir(join(packageRoot, "node_modules", name), { recursive: true });
  return packageRoot;
}

function runPrune(root: string): ReturnType<typeof spawnSync> {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", script, root],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
}

void test("prune removes forbidden A and its orphan B, but keeps an independent package", async () => {
  const root = await makeDeployRoot();
  const forbidden = await makePackage(root, "prisma@fixture", "prisma");
  await makePackage(root, "orphan@fixture", "orphan");
  await makePackage(root, "independent@fixture", "independent");
  await symlink(
    ".pnpm/prisma@fixture/node_modules/prisma",
    join(root, "node_modules", "prisma"),
  );
  await symlink(
    "../../orphan@fixture/node_modules/orphan",
    join(forbidden, "node_modules", "orphan"),
  );
  await symlink(
    ".pnpm/independent@fixture/node_modules/independent",
    join(root, "node_modules", "independent"),
  );

  const result = runPrune(root);
  assert.equal(result.status, 0, String(result.stderr));
  await assert.rejects(
    lstat(join(root, "node_modules", ".pnpm", "prisma@fixture")),
    { code: "ENOENT" },
  );
  await assert.rejects(
    lstat(join(root, "node_modules", ".pnpm", "orphan@fixture")),
    { code: "ENOENT" },
  );
  await lstat(
    join(
      root,
      "node_modules",
      ".pnpm",
      "independent@fixture",
      "node_modules",
      "independent",
    ),
  );
});

void test("prune keeps a forbidden transitive when an allowed root reaches it", async () => {
  const root = await makeDeployRoot();
  const forbidden = await makePackage(root, "prisma@fixture", "prisma");
  await makePackage(root, "shared@fixture", "shared");
  const independent = await makePackage(
    root,
    "independent@fixture",
    "independent",
  );
  await symlink(
    "../../shared@fixture/node_modules/shared",
    join(forbidden, "node_modules", "shared-from-prisma"),
  );
  await symlink(
    ".pnpm/independent@fixture/node_modules/independent",
    join(root, "node_modules", "independent"),
  );
  await symlink(
    "../../shared@fixture/node_modules/shared",
    join(independent, "node_modules", "shared"),
  );

  const result = runPrune(root);
  assert.equal(result.status, 0, String(result.stderr));
  await assert.rejects(
    lstat(join(root, "node_modules", ".pnpm", "prisma@fixture")),
    { code: "ENOENT" },
  );
  await lstat(join(root, "node_modules", ".pnpm", "shared@fixture"));
});

void test("prune refuses a non-deploy root before mutating it", async () => {
  const root = await makeDeployRoot("customreport");
  const sentinel = join(root, "sentinel.txt");
  await writeFile(sentinel, "untouched\n");
  const result = runPrune(root);
  assert.notEqual(result.status, 0);
  assert.match(
    `${String(result.stdout)}${String(result.stderr)}`,
    /refusing to prune/u,
  );
  assert.equal(await readFile(sentinel, "utf8"), "untouched\n");
  await readFile(join(root, "node_modules", ".modules.yaml"));
});
