import { lstat, readdir, readFile, realpath, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

// `pnpm deploy` resolves peer contexts from the workspace lockfile. Some of
// those contexts retain Prisma CLI and compiler payloads even with --prod.
// This is an explicit production-image policy: the API never needs these
// packages at runtime, so remove their virtual-store entries and links.
const EXPLICITLY_FORBIDDEN_VIRTUAL_STORE_ENTRY = [
  /^@customreport\+migrator-runtime@/u,
  /^prisma@/u,
  /^@prisma\+(config|dev|engines|engines-version|fetch-engine|get-platform|query-plan-executor|streams-local|studio-core)@/u,
  /^@typescript\+typescript6@/u,
  /^typescript@/u,
];

const root = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  throw new Error("usage: production-deps-prune.ts <deploy-root>");
}

const deployManifest = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
) as { readonly name?: unknown; readonly private?: unknown };
if (
  root === resolve(process.cwd()) ||
  deployManifest.name !== "@customreport/api" ||
  deployManifest.private !== true
) {
  throw new Error(
    "refusing to prune: target is not an isolated @customreport/api deploy root",
  );
}
for (const requiredPath of [
  join(root, "node_modules", ".pnpm"),
  join(root, "node_modules", ".modules.yaml"),
] as const) {
  await lstat(requiredPath);
}

const virtualStore = await realpath(join(root, "node_modules", ".pnpm"));
const entries = (await readdir(virtualStore, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
  .map((entry) => entry.name);
const explicitlyForbiddenEntries = new Set(
  entries.filter((entry) =>
    EXPLICITLY_FORBIDDEN_VIRTUAL_STORE_ENTRY.some((pattern) =>
      pattern.test(entry),
    ),
  ),
);

async function walkSymlinks(directory: string): Promise<string[]> {
  const found: string[] = [];
  const children = await readdir(directory, { withFileTypes: true });
  for (const child of children) {
    const path = join(directory, child.name);
    if (child.isSymbolicLink()) {
      found.push(path);
    } else if (child.isDirectory()) {
      found.push(...(await walkSymlinks(path)));
    }
  }
  return found;
}

function virtualStoreEntryFor(target: string): string | undefined {
  const relativeTarget = relative(virtualStore, target);
  const [entry] = relativeTarget.split("/");
  return entry && entry !== "node_modules" ? entry : undefined;
}

const packageEntryForLink = async (
  link: string,
): Promise<string | undefined> => {
  const target = await realpath(link);
  return virtualStoreEntryFor(target);
};

const packageDirectories = new Map(
  entries.map((entry) => [entry, join(virtualStore, entry)]),
);
const reachableEntries = new Set<string>();
const queue: string[] = [];
for (const link of await walkSymlinks(join(root, "node_modules"))) {
  if (link.includes("/node_modules/.pnpm/")) continue;
  const entry = await packageEntryForLink(link);
  if (
    entry &&
    packageDirectories.has(entry) &&
    !explicitlyForbiddenEntries.has(entry)
  ) {
    queue.push(entry);
  }
}
while (queue.length > 0) {
  const entry = queue.pop();
  if (
    !entry ||
    explicitlyForbiddenEntries.has(entry) ||
    reachableEntries.has(entry)
  ) {
    continue;
  }
  reachableEntries.add(entry);
  const packageDirectory = packageDirectories.get(entry);
  if (!packageDirectory) continue;
  for (const link of await walkSymlinks(packageDirectory)) {
    const dependency = await packageEntryForLink(link);
    if (
      dependency &&
      packageDirectories.has(dependency) &&
      !explicitlyForbiddenEntries.has(dependency)
    ) {
      queue.push(dependency);
    }
  }
}

const forbiddenEntries = new Set(
  entries.filter(
    (entry) =>
      explicitlyForbiddenEntries.has(entry) || !reachableEntries.has(entry),
  ),
);
const forbiddenLinks: string[] = [];
for (const link of await walkSymlinks(join(root, "node_modules"))) {
  const entry = await packageEntryForLink(link);
  if (entry && forbiddenEntries.has(entry)) {
    forbiddenLinks.push(link);
  }
}

// Discovery must finish before any planned link or package is removed.
for (const link of forbiddenLinks) {
  await rm(link);
}

for (const entry of forbiddenEntries) {
  await rm(join(virtualStore, entry), { recursive: true, force: true });
}

const remainingEntries = (await readdir(virtualStore, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const remainingForbidden = remainingEntries.filter((entry) =>
  forbiddenEntries.has(entry),
);
if (remainingForbidden.length > 0) {
  throw new Error(
    `forbidden production dependency payload remains: ${remainingForbidden.join(", ")}`,
  );
}

const dangling: string[] = [];
for (const link of await walkSymlinks(join(root, "node_modules"))) {
  if (link.includes("/node_modules/.pnpm/")) continue;
  try {
    await lstat(link);
    await realpath(link);
  } catch {
    dangling.push(link);
  }
}
if (dangling.length > 0) {
  throw new Error(
    `dangling production dependency links: ${dangling.join(", ")}`,
  );
}

console.log(
  JSON.stringify({
    removedEntries: [...forbiddenEntries].sort((a, b) => a.localeCompare(b)),
    removedLinks: forbiddenLinks
      .map((path) => relative(root, path))
      .sort((a, b) => a.localeCompare(b)),
  }),
);
