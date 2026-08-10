import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

import { assertSourceSha, sha256Hex } from "../support/ids.ts";
import {
  type Action,
  type Exclusion,
  type MatrixDeclaration,
  type Role,
  type RouteDeclarationInput,
  type SeedProfile,
  type SeedProfileDefinition,
  type StateKind,
  type ToolVersions,
  type Viewport,
} from "./contracts.ts";

const execFileAsync = promisify(execFile);
const SOURCE_TREE_PATTERN = /^[0-9a-f]{40}$/u;

export interface SeedProfileDefinitionInput {
  readonly profile: SeedProfile;
  readonly definition: SeedProfileDefinition;
}

export interface CampaignManifestInput {
  readonly repoRoot: string;
  readonly outputPath: string;
  readonly sourcePath?: string;
  readonly preflightPath?: string;
  readonly campaignId: string;
  readonly sourceSha: string;
  readonly browser: "chromium";
  readonly viewport: Viewport;
  readonly roles: readonly Role[];
  readonly routes: readonly RouteDeclarationInput[];
  readonly profiles: readonly SeedProfile[];
  readonly seedProfiles: readonly SeedProfileDefinitionInput[];
  readonly stateKinds: readonly StateKind[];
  readonly actions: readonly Action[];
  readonly toolVersions: ToolVersions;
  readonly catalogPaths: readonly string[];
  readonly domainSpecPaths: readonly string[];
  readonly matrixDeclaration: MatrixDeclaration;
  readonly matrixLimits: Readonly<{
    readonly maxCases: number;
    readonly maxControlsPerSegment: number;
  }>;
  readonly exclusions: readonly Exclusion[];
}

export type ManifestCommandRunner = (
  args: readonly string[],
  cwd: string,
) => Promise<string>;

export class ManifestInputError extends Error {
  override readonly name = "ManifestInputError";
}

export class DirtyWorktreeError extends Error {
  override readonly name = "DirtyWorktreeError";
}

export class SourceShaMismatchError extends Error {
  override readonly name = "SourceShaMismatchError";
}

export class ManifestGitError extends Error {
  override readonly name = "ManifestGitError";
}

export class ManifestWriteError extends Error {
  override readonly name = "ManifestWriteError";
}

export async function runGitCommand(
  args: readonly string[],
  cwd: string,
): Promise<string> {
  try {
    const result = await execFileAsync("git", [...args], { cwd });
    return result.stdout;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new ManifestGitError(
        `git ${args.join(" ")} failed: ${error.message}`,
      );
    }
    throw error;
  }
}

export function requirePath(value: string, label: string): string {
  if (value.trim() === "") throw new ManifestInputError(`${label} is required`);
  return path.resolve(value);
}

function relativeRepoPath(repoRoot: string, filePath: string): string {
  const absolute = path.resolve(repoRoot, filePath);
  const relative = path.relative(repoRoot, absolute);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new ManifestInputError(
      `Manifest input must be inside repoRoot: ${filePath}`,
    );
  }
  return relative.split(path.sep).join("/");
}

function digestBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  Reflect.ownKeys(value).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.value !== undefined) freezeDeep(descriptor.value);
  });
  return Object.freeze(value);
}

export async function digestFiles(
  repoRoot: string,
  paths: readonly string[],
  label: string,
): Promise<string> {
  if (paths.length === 0)
    throw new ManifestInputError(`${label} paths are required`);
  const entries = await Promise.all(
    paths.map(async (filePath) => {
      const relative = relativeRepoPath(repoRoot, filePath);
      const bytes = await readFile(path.resolve(repoRoot, filePath));
      return { path: relative, digest: digestBytes(bytes) };
    }),
  );
  const uniquePaths = new Set(entries.map(({ path: filePath }) => filePath));
  if (uniquePaths.size !== entries.length)
    throw new ManifestInputError(`${label} paths must be unique`);
  return sha256Hex(
    entries.toSorted((left, right) => left.path.localeCompare(right.path)),
  );
}

export async function cleanTreeDigest(
  input: CampaignManifestInput,
  runCommand: ManifestCommandRunner,
): Promise<string> {
  assertSourceSha(input.sourceSha);
  const status = await runCommand(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    input.repoRoot,
  );
  if (status.trim() !== "")
    throw new DirtyWorktreeError("Campaign source worktree is not clean");
  const head = (
    await runCommand(["rev-parse", "--verify", "HEAD"], input.repoRoot)
  ).trim();
  if (!SOURCE_TREE_PATTERN.test(head))
    throw new ManifestGitError("git HEAD is not a full lowercase commit SHA");
  if (head !== input.sourceSha)
    throw new SourceShaMismatchError(
      `Campaign source SHA ${input.sourceSha} does not match HEAD ${head}`,
    );
  const tree = (
    await runCommand(["rev-parse", "--verify", "HEAD^{tree}"], input.repoRoot)
  ).trim();
  if (!SOURCE_TREE_PATTERN.test(tree))
    throw new ManifestGitError("git HEAD tree is not a full lowercase SHA");
  return sha256Hex({ sourceSha: input.sourceSha, tree });
}

export async function writeManifestFile(
  outputPath: string,
  text: string,
): Promise<void> {
  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, { encoding: "utf8", flag: "wx" });
  } catch (error: unknown) {
    if (error instanceof Error)
      throw new ManifestWriteError(
        `Cannot create immutable campaign manifest at ${outputPath}: ${error.message}`,
      );
    throw error;
  }
}

export async function writeAtomicManifestPair(
  input: {
    readonly matrixPath: string;
    readonly matrixText: string;
    readonly manifestPath: string;
    readonly manifestText: string;
  },
  publishFile: (oldPath: string, newPath: string) => Promise<void> = link,
): Promise<void> {
  const directory = path.dirname(input.manifestPath);
  if (path.dirname(input.matrixPath) !== directory) {
    throw new ManifestWriteError(
      "Cannot atomically create campaign artifacts in different directories",
    );
  }
  const temporaryDirectory = await mkdtemp(
    path.join(directory, `.runtime-sweep-${process.pid}-`),
  );
  try {
    await writeFile(
      path.join(temporaryDirectory, "MATRIX.json"),
      input.matrixText,
      {
        encoding: "utf8",
        flag: "wx",
      },
    );
    await writeFile(
      path.join(temporaryDirectory, "MANIFEST.json"),
      input.manifestText,
      { encoding: "utf8", flag: "wx" },
    );
    await publishFile(
      path.join(temporaryDirectory, "MATRIX.json"),
      input.matrixPath,
    );
    try {
      await publishFile(
        path.join(temporaryDirectory, "MANIFEST.json"),
        input.manifestPath,
      );
    } catch (error: unknown) {
      await unlink(input.matrixPath);
      throw error;
    }
  } catch (error: unknown) {
    if (error instanceof Error)
      throw new ManifestWriteError(
        `Cannot atomically create campaign artifacts MATRIX.json and MANIFEST.json: ${error.message}`,
      );
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
