import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BYTES_PER_KIB = 1024;
const MAX_BUFFER_KIB = 128;
const MAX_BUFFER_SIZE = MAX_BUFFER_KIB * BYTES_PER_KIB * BYTES_PER_KIB;
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "coverage",
]);
const ALLOWED_IGNORED_PREFIXES = ["prisma/generated"];
const FORBIDDEN_PATHS = [
  /^openspec\/changes\/archive(?:\/|$)/,
  /^openspec\/deferred(?:\/|$)/,
  /(?:^|\/)HANDOFF-[^/]+$/i,
  /(?:^|\/)[^/]*\.data\.json$/i,
  /(?:^|\/)(?:browser-harness|browser-harnesses|playwright-report|test-results|session-artifacts)(?:\/|$)/i,
  /(?:^|\/)[^/]*\.session(?:\/|$)/i,
  /(?:^|\/)(?:report|session)-(?:dump|export|artifact)(?:\.|\/|$)/i,
];

export interface RepositoryInventory {
  tracked: string[];
  untracked: string[];
  ignored: string[];
  emptyDirectories: string[];
}

async function gitPaths(root: string, args: string[]): Promise<string[]> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: root,
    maxBuffer: MAX_BUFFER_SIZE,
  });
  return stdout.split("\0").filter(Boolean);
}

async function findEmptyDirectories(root: string): Promise<string[]> {
  const findings: string[] = [];
  const isAllowedDirectory = (directory: string): boolean => {
    const path = relative(root, directory);
    return (
      path === "prisma/generated" ||
      ALLOWED_IGNORED_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      ) ||
      /(^|\/)(?:node_modules|\.next|dist|coverage|\.turbo)(?:\/|$)/.test(path)
    );
  };
  const visit = async (directory: string): Promise<void> => {
    if (isAllowedDirectory(directory)) return;
    const entries = await readdir(directory, { withFileTypes: true });
    if (entries.length === 0) findings.push(relative(root, directory) || ".");
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        IGNORED_DIRECTORY_NAMES.has(entry.name)
      )
        continue;
      await visit(join(directory, entry.name));
    }
  };
  await visit(root);
  return findings.sort((left, right) => left.localeCompare(right));
}

export async function inventoryRepository(
  rootInput: string,
): Promise<RepositoryInventory> {
  const root = resolve(rootInput);
  const [tracked, untracked, ignored, emptyDirectories] = await Promise.all([
    gitPaths(root, ["ls-files", "-z"]),
    gitPaths(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
    gitPaths(root, [
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "-z",
    ]),
    findEmptyDirectories(root),
  ]);
  return { tracked, untracked, ignored, emptyDirectories };
}

function isForbidden(path: string): boolean {
  return FORBIDDEN_PATHS.some((pattern) => pattern.test(path));
}

function isAllowedIgnored(path: string): boolean {
  if (
    ALLOWED_IGNORED_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  )
    return true;
  if (/(^|\/)node_modules(?:\/|$)/.test(path)) return true;
  if (/(^|\/)(?:\.next|dist|coverage|\.turbo)(?:\/|$)/.test(path)) return true;
  if (/(^|\/)(?:\.env|\.env\.[^/]+)$/.test(path)) return true;
  return path.endsWith(".tsbuildinfo");
}

export function validateInventory(inventory: RepositoryInventory): string[] {
  return [
    ...inventory.tracked.filter(isForbidden).map((path) => `tracked: ${path}`),
    ...inventory.untracked.map((path) => `untracked: ${path}`),
    ...inventory.ignored
      .filter((path) => !isAllowedIgnored(path))
      .map((path) => `ignored: ${path}`),
    ...inventory.emptyDirectories.map((path) => `empty: ${path}`),
  ].sort((left, right) => left.localeCompare(right));
}

export async function assertRepositoryClean(root: string): Promise<void> {
  const findings = validateInventory(await inventoryRepository(root));
  if (findings.length > 0)
    throw new Error(
      `Repository contains forbidden residue:\n${findings.join("\n")}`,
    );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  await assertRepositoryClean(process.cwd());
}
