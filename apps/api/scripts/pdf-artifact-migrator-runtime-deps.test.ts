import {
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractRuntimeDeps } from "./pdf-artifact-migrator-runtime-deps.js";

const writePackage = async (
  store: string,
  entry: string,
  name: string,
  files: Record<string, string> = {},
): Promise<string> => {
  const dir = join(store, entry, "node_modules", name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name, version: "1.0.0" }),
    "utf8",
  );
  for (const [file, content] of Object.entries(files)) {
    await writeFile(join(dir, file), content, "utf8");
  }
  return dir;
};

describe("extractRuntimeDeps", () => {
  let workdir = "";

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), "pdf-migrator-deps-"));
  });
  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it("copies only the store entries reachable from the pg link", async () => {
    const modules = join(workdir, "node_modules");
    const store = join(modules, ".pnpm");
    await writePackage(store, "pg@8.23.0", "pg", { "index.js": "pg" });
    await writePackage(store, "pg-dep@1.0.0", "pg-dep", {
      "index.js": "dep",
    });
    await writePackage(store, "unrelated@9.9.9", "unrelated");
    await symlink(
      join("..", "..", "pg-dep@1.0.0", "node_modules", "pg-dep"),
      join(store, "pg@8.23.0", "node_modules", "pg-dep"),
    );
    await mkdir(modules, { recursive: true });
    await symlink(
      join(".pnpm", "pg@8.23.0", "node_modules", "pg"),
      join(modules, "pg"),
    );

    const output = join(workdir, "out");
    const result = await extractRuntimeDeps(modules, output);

    expect(result.entries).toEqual(["pg-dep@1.0.0", "pg@8.23.0"]);
    const pgLink = await lstat(join(output, "node_modules", "pg"));
    expect(pgLink.isSymbolicLink()).toBe(true);
    const resolved = await realpath(join(output, "node_modules", "pg"));
    expect(relative(await realpath(output), resolved)).toBe(
      join("node_modules", ".pnpm", "pg@8.23.0", "node_modules", "pg"),
    );
    // The dependency edge inside the copied entry resolves into the copied
    // store, not back to the source tree.
    const dep = await realpath(
      join(
        output,
        "node_modules",
        ".pnpm",
        "pg@8.23.0",
        "node_modules",
        "pg-dep",
      ),
    );
    expect(relative(await realpath(output), dep)).toBe(
      join("node_modules", ".pnpm", "pg-dep@1.0.0", "node_modules", "pg-dep"),
    );
    await expect(
      lstat(join(output, "node_modules", ".pnpm", "unrelated@9.9.9")),
    ).rejects.toThrow();
  });

  it("fails closed when pg is not installed in the store", async () => {
    const modules = join(workdir, "node_modules");
    await mkdir(join(modules, ".pnpm"), { recursive: true });
    await expect(
      extractRuntimeDeps(modules, join(workdir, "out")),
    ).rejects.toThrow(/not installed/u);
  });
});
