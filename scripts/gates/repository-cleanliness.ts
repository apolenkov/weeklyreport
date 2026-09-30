import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { parse } from "yaml";

const execFileAsync = promisify(execFile);
const BYTES_PER_KIB = 1024;
const MAX_BUFFER_KIB = 128;
const MAX_BUFFER_SIZE = MAX_BUFFER_KIB * BYTES_PER_KIB * BYTES_PER_KIB;
const OPENSPEC_INDEX_PATH = "openspec/specs/README.md";
const OPENSPEC_SPEC_PATH = /^openspec\/specs\/([^/]+)\/spec\.md$/u;
const ALLOWED_IGNORED_FILES = new Set([
  "apps/web/next-env.d.ts",
  ".pi/.goals-pool-snapshot.json",
  ".pi/pi-goal-x-settings.json",
]);
const ALLOWED_IGNORED_PATHS = [
  /(^|\/)node_modules(?:\/|$)/u,
  /(^|\/)(?:\.next(?:-docker-dev)?|dist|coverage|\.turbo)(?:\/|$)/u,
  /(^|\/)(?:\.env|\.env\.[^/]+)$/u,
  /(^|\/)(?:\.opencode|\.playwright-cli|\.playwright-mcp|output)(?:\/|$)/u,
  /(^|\/)codex-session-[^/]+\.md$/u,
  /(^|\/)pi-session-[^/]+\.html$/u,
  /(^|\/)\.pi\/(?:goals|subagents)(?:\/|$)/u,
  /^(?:\.agents|\.claude)\/skills\/(?:openspec-[^/]+\/|\.openspec-target$)/u,
  /^\.claude\/commands\/opsx\//u,
];
const ALLOWED_EMPTY_DIRECTORIES = new Set(["openspec/changes/archive"]);
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  ".next-docker-dev",
  "dist",
  "coverage",
  ".opencode",
  ".playwright-cli",
  ".playwright-mcp",
  "output",
  ".pi",
]);
const FORBIDDEN_PATHS = [
  /^openspec\/changes\/archive(?:\/|$)/,
  /^openspec\/deferred(?:\/|$)/,
  /(?:^|\/)HANDOFF-[^/]+$/i,
  /(?:^|\/)[^/]*\.data\.json$/i,
  /(?:^|\/)(?:browser-harness|browser-harnesses|playwright-report|test-results|session-artifacts)(?:\/|$)/i,
  /(?:^|\/)[^/]*\.session(?:\/|$)/i,
  /(?:^|\/)(?:report|session)-(?:dump|export|artifact)(?:\.|\/|$)/i,
  /(?:^|\/)patches(?:\/|$)/,
  /(?:^|\/)[^/]*\.patch$/i,
  /(?:^|\/)[^/]*\.diff$/i,
];
const DEPENDENCY_MANIFEST_PATH =
  /(?:^|\/)package\.json$|(?:^|\/)pnpm-workspace\.yaml$/;
const PATCHED_DEPENDENCIES_PATTERNS = [
  /^patchedDependencies\s*:/mu,
  /["']patchedDependencies["']\s*:/u,
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
    if (ALLOWED_EMPTY_DIRECTORIES.has(path)) return true;
    return /(^|\/)(?:node_modules|\.next(?:-docker-dev)?|dist|coverage|\.turbo)(?:\/|$)/.test(
      path,
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
  if (path.endsWith(".tsbuildinfo")) return true;
  if (ALLOWED_IGNORED_FILES.has(path)) return true;
  return ALLOWED_IGNORED_PATHS.some((pattern) => pattern.test(path));
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

export async function validateOpenSpecIndex(
  rootInput: string,
  tracked: readonly string[],
): Promise<string[]> {
  const specNames = tracked.flatMap((path) => {
    const match = OPENSPEC_SPEC_PATH.exec(path);
    return match?.[1] ? [match[1]] : [];
  });
  if (specNames.length === 0) return [];
  if (!tracked.includes(OPENSPEC_INDEX_PATH)) {
    return [`openspec-index: missing ${OPENSPEC_INDEX_PATH}`];
  }

  const index = await readFile(resolve(rootInput, OPENSPEC_INDEX_PATH), "utf8");
  const indexedNames = [
    ...index.matchAll(/\]\(\.\/([^/]+)\/spec\.md\)/gu),
  ].flatMap((match) => (match[1] ? [match[1]] : []));
  const indexed = new Set(indexedNames);
  const specs = new Set(specNames);
  const duplicates = indexedNames.filter(
    (name, position) => indexedNames.indexOf(name) !== position,
  );

  return [...new Set(duplicates).values()]
    .map((name) => `openspec-index: duplicate ${name}`)
    .concat(
      [...specs]
        .filter((name) => !indexed.has(name))
        .map((name) => `openspec-index: unindexed ${name}`),
      [...indexed]
        .filter((name) => !specs.has(name))
        .map((name) => `openspec-index: missing spec ${name}`),
    )
    .sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function manifestDeclaresPatchedDependencies(
  path: string,
  manifest: string,
): boolean {
  try {
    const parsed: unknown = path.endsWith(".json")
      ? JSON.parse(manifest)
      : parse(manifest);
    return (
      isRecord(parsed) &&
      ("patchedDependencies" in parsed ||
        (isRecord(parsed.pnpm) && "patchedDependencies" in parsed.pnpm))
    );
  } catch {
    return PATCHED_DEPENDENCIES_PATTERNS.some((pattern) =>
      pattern.test(manifest),
    );
  }
}

export async function validateDependencyIntegrity(
  rootInput: string,
  tracked: readonly string[],
): Promise<string[]> {
  const root = resolve(rootInput);
  const findings: string[] = [];
  for (const path of tracked) {
    if (!DEPENDENCY_MANIFEST_PATH.test(path)) continue;
    const manifest = await readFile(resolve(root, path), "utf8");
    if (manifestDeclaresPatchedDependencies(path, manifest))
      findings.push(`dependency-patches: ${path}`);
  }
  return findings.sort((left, right) => left.localeCompare(right));
}

export async function assertRepositoryClean(root: string): Promise<void> {
  const inventory = await inventoryRepository(root);
  const findings = [
    ...validateInventory(inventory),
    ...(await validateOpenSpecIndex(root, inventory.tracked)),
    ...(await validateDependencyIntegrity(root, inventory.tracked)),
  ].sort((left, right) => left.localeCompare(right));
  if (findings.length > 0)
    throw new Error(
      `Repository contains forbidden residue:\n${findings.join("\n")}`,
    );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  await assertRepositoryClean(process.cwd());
}
