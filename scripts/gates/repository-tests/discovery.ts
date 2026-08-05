import { readFileSync } from "node:fs";

const REPOSITORY_TEST_PATH =
  /^scripts\/.+\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const PACKAGE_TEST_PATH =
  /scripts\/[A-Za-z0-9_./-]+\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)/g;
const AGGREGATE_SCRIPT = /script:\s*"([^"]+)"/g;

export interface PackageTestReference {
  readonly path: string;
  readonly script: string;
}

export interface DiscoveryInput {
  readonly currentPaths: readonly string[];
  readonly manifest: readonly {
    readonly path: string;
    readonly owner: string;
  }[];
  readonly packageTestReferences: readonly PackageTestReference[];
  readonly aggregateScripts: readonly string[];
}

export interface DiscoveryReport {
  readonly currentCount: number;
  readonly manifestCount: number;
  readonly packageScriptCount: number;
  readonly paths: readonly string[];
}

const normalize = (value: string): string =>
  value.replaceAll("\\", "/").replace(/^\.\//, "");

const counts = (values: readonly string[]): ReadonlyMap<string, number> =>
  values.reduce(
    (result, value) => new Map(result).set(value, (result.get(value) ?? 0) + 1),
    new Map<string, number>(),
  );

const repeated = (values: readonly string[]): readonly string[] =>
  [...counts(values).entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((left, right) => left.localeCompare(right));

const pathList = (values: readonly string[]): readonly string[] =>
  [...new Set(values.map(normalize))].filter((path) =>
    REPOSITORY_TEST_PATH.test(path),
  );

const describe = (paths: readonly string[]): string =>
  paths.length === 0 ? "none" : paths.join(", ");

/** Extracts explicit script-test paths from package.json commands. */
export const packageTestReferences = (
  scripts: Readonly<Record<string, string>>,
): readonly PackageTestReference[] =>
  Object.entries(scripts).flatMap(([script, command]) =>
    [...command.matchAll(PACKAGE_TEST_PATH)].map(([path]) => ({
      path: normalize(path),
      script,
    })),
  );

export const aggregateCheckScripts = (source: string): readonly string[] =>
  [...source.matchAll(AGGREGATE_SCRIPT)]
    .map(([, script]) => script)
    .filter((script): script is string => script !== undefined);

/**
 * Checks that every current script test has one and only one owner.
 *
 * Existing package scripts remain valid owners; the explicit manifest owns the
 * tests that had no normal package command. Duplicate and stale references are
 * errors so a moved or copied test cannot silently disappear from the gate.
 */
export const validateRepositoryTestOwnership = (
  input: DiscoveryInput,
): DiscoveryReport => {
  const current = pathList(input.currentPaths);
  const manifest = input.manifest.map((entry) => normalize(entry.path));
  const aggregateScripts = new Set(input.aggregateScripts);
  const activePackageReferences = input.packageTestReferences.filter((entry) =>
    aggregateScripts.has(entry.script),
  );
  const packagePaths = activePackageReferences.map((entry) =>
    normalize(entry.path),
  );
  const currentSet = new Set(current);
  const manifestSet = new Set(manifest);
  const packageSet = new Set(packagePaths);
  const errors = [
    ...repeated(manifest).map(
      (path) => `duplicate repository-test manifest owner: ${path}`,
    ),
    ...repeated(packagePaths).map(
      (path) => `duplicate package-test owner: ${path}`,
    ),
    ...manifest
      .filter((path) => !currentSet.has(path))
      .map((path) => `stale repository-test manifest entry: ${path}`),
    ...packagePaths
      .filter((path) => !currentSet.has(path))
      .map((path) => `stale package-test reference: ${path}`),
    ...current
      .filter((path) => !manifestSet.has(path) && !packageSet.has(path))
      .map((path) => `missing repository-test owner: ${path}`),
    ...current
      .filter((path) => manifestSet.has(path) && packageSet.has(path))
      .map((path) => `duplicate repository-test owners: ${path}`),
  ];
  if (errors.length > 0) {
    throw new Error(`repository-test discovery failed:\n${describe(errors)}`);
  }
  return {
    currentCount: current.length,
    manifestCount: manifest.length,
    packageScriptCount: packagePaths.length,
    paths: current,
  };
};

/** Reads the package script map without allowing malformed JSON to pass. */
export const readPackageScripts = (
  path: string,
): Readonly<Record<string, string>> => {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || !("scripts" in parsed)) {
    throw new Error(`package.json has no scripts map: ${path}`);
  }
  const scripts = parsed.scripts;
  if (typeof scripts !== "object" || scripts === null) {
    throw new Error(`package.json scripts must be an object: ${path}`);
  }
  const entries = Object.entries(scripts);
  if (entries.some(([, command]) => typeof command !== "string")) {
    throw new Error(`package.json scripts must contain only strings: ${path}`);
  }
  return Object.fromEntries(
    entries.map(([name, command]) => [name, command as string]),
  );
};
