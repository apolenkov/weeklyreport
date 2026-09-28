import type { Dirent } from "node:fs";
import { cp, mkdir, readdir, realpath, symlink } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

// The pdf-artifact-migrator is a compiled CLI inside apps/api — not a workspace
// package — so `pnpm deploy` cannot produce a minimal prod tree for it (and a
// new importer would change pnpm-lock.yaml, which TASK-047 forbids). The image
// needs exactly the pg dependency closure: walk the lockfile-installed .pnpm
// store from the pg link, following the dependency links pnpm materialized, and
// copy only the reachable entries. OptionalDependencies that were installed
// (pg-cloudflare) are part of the closure; absent ones are simply not linked.

const RUNTIME_PACKAGE = "pg";

export interface RuntimeDepsResult {
  readonly entries: string[];
  readonly outputModules: string;
}

const isFsError = (error: unknown, code: string): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === code;

const entryForLink = async (
  store: string,
  link: string,
): Promise<string | undefined> => {
  try {
    const target = await realpath(link);
    const relativeTarget = relative(store, target);
    if (relativeTarget === "" || relativeTarget.startsWith("..")) {
      return undefined;
    }
    const [entry] = relativeTarget.split(sep);
    return entry === "node_modules" || entry === undefined || entry === ""
      ? undefined
      : entry;
  } catch {
    return undefined;
  }
};

const symlinksUnder = async (directory: string): Promise<string[]> => {
  const found: string[] = [];
  const children: Dirent[] = await readdir(directory, {
    withFileTypes: true,
  }).catch(() => []);
  for (const child of children) {
    const path = join(directory, child.name);
    if (child.isSymbolicLink()) {
      found.push(path);
    } else if (child.isDirectory()) {
      found.push(...(await symlinksUnder(path)));
    }
  }
  return found;
};

const collectReachable = async (
  store: string,
  seedEntry: string,
): Promise<string[]> => {
  const reachable = new Set<string>();
  const queue: string[] = [seedEntry];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    if (reachable.has(next)) continue;
    reachable.add(next);
    const links = await symlinksUnder(join(store, next, "node_modules"));
    for (const link of links) {
      const dependency = await entryForLink(store, link);
      if (dependency !== undefined && !reachable.has(dependency)) {
        queue.push(dependency);
      }
    }
  }
  return [...reachable].sort((a, b) => a.localeCompare(b));
};

export const extractRuntimeDeps = async (
  modulesRootInput: string,
  outputRootInput: string,
): Promise<RuntimeDepsResult> => {
  const modulesRoot = resolve(modulesRootInput);
  // realpath the store before comparing targets: intermediate components of
  // modulesRoot may themselves be symlinks (e.g. /var -> /private/var).
  const store = await realpath(join(modulesRoot, ".pnpm")).catch(
    (error: unknown) => {
      if (isFsError(error, "ENOENT")) return "";
      throw error;
    },
  );
  if (store === "") {
    throw new Error(
      `no .pnpm store under ${modulesRoot}: ${RUNTIME_PACKAGE} is not installed`,
    );
  }

  const seedEntry = await entryForLink(
    store,
    join(modulesRoot, RUNTIME_PACKAGE),
  );
  if (seedEntry === undefined) {
    throw new Error(
      `${RUNTIME_PACKAGE} is not installed in the .pnpm store at ${store}`,
    );
  }

  const entries = await collectReachable(store, seedEntry);
  const outputModules = join(resolve(outputRootInput), "node_modules");
  const outputStore = join(outputModules, ".pnpm");
  await mkdir(outputStore, { recursive: true });
  for (const entry of entries) {
    await cp(join(store, entry), join(outputStore, entry), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
  await symlink(
    join(".pnpm", seedEntry, "node_modules", RUNTIME_PACKAGE),
    join(outputModules, RUNTIME_PACKAGE),
  );
  return { entries, outputModules };
};

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const [modulesRoot, outputRoot] = process.argv.slice(2);
  if (modulesRoot === undefined || outputRoot === undefined) {
    throw new Error(
      "usage: pdf-artifact-migrator-runtime-deps.ts <node_modules-root> <output-root>",
    );
  }
  const result = await extractRuntimeDeps(modulesRoot, outputRoot);
  console.log(JSON.stringify(result));
}
