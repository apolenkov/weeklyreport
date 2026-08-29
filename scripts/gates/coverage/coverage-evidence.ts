import { readFileSync } from "node:fs";

interface CoverageMetric {
  readonly total: number;
  readonly covered?: number;
}

interface CoverageSummary {
  readonly total?: Partial<Record<"lines" | "statements" | "functions" | "branches", CoverageMetric>>;
  readonly [path: string]: unknown;
}

export type CoverageScope = "api" | "web";

const API_EXCLUDED = [
  /^src\/.*\.test\.tsx?$/u,
  /^src\/.*\.integration\.test\.ts$/u,
  /^src\/.*\.eval\.test\.ts$/u,
  /^src\/(?:.*\/)?__tests__\//u,
  /^src\/(?:.*\/)?test-utils\//u,
  /^src\/main\.ts$/u,
  /^src\/.*\.module\.ts$/u,
] as const;

const WEB_EXCLUDED = [
  /^src\/.*\.test\.tsx?$/u,
  /^src\/(?:.*\/)?__tests__\//u,
  /^src\/(?:.*\/)?types\.ts$/u,
  /^src\/app\/(?:.*\/)?layout\.tsx$/u,
  /^src\/app\/\(app\)\/admin\/products\/page\.tsx$/u,
  /^src\/app\/\(app\)\/admin\/activities\/page\.tsx$/u,
  /^src\/app\/\(app\)\/admin\/settings\/page\.tsx$/u,
  /^src\/app\/\(app\)\/head\/history\/page\.tsx$/u,
  /^src\/app\/\(app\)\/head\/slides\/page\.tsx$/u,
  /^src\/app\/\(app\)\/lead\/history\/page\.tsx$/u,
  /^src\/app\/\(app\)\/reports\/history\/page\.tsx$/u,
] as const;

const relativeSourcePath = (filePath: string): string | undefined => {
  const normalized = filePath.replaceAll("\\", "/");
  const srcOffset = normalized.lastIndexOf("/src/");
  if (srcOffset !== -1) return normalized.slice(srcOffset + 1);
  return normalized.startsWith("src/") ? normalized : undefined;
};

const belongsToScopePackage = (
  filePath: string,
  scope: CoverageScope,
): boolean => {
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.startsWith("src/")) return true;
  return normalized.includes(`/apps/${scope}/src/`);
};

const isExpectedSourceFile = (
  filePath: string,
  scope: CoverageScope,
): boolean => {
  const relative = relativeSourcePath(filePath);
  if (
    relative === undefined ||
    !belongsToScopePackage(filePath, scope) ||
    !/^src\/.+\.tsx?$/u.test(relative)
  ) {
    return false;
  }
  const excluded = scope === "api" ? API_EXCLUDED : WEB_EXCLUDED;
  return !excluded.some((pattern) => pattern.test(relative));
};

export interface CoverageEvidence {
  readonly fileCount: number;
  readonly totals: Readonly<Record<"lines" | "statements" | "functions" | "branches", number>>;
}

export const assertNonEmptyCoverageSummary = (
  summary: unknown,
  sourcePath: string,
  scope: CoverageScope,
): CoverageEvidence => {
  if (typeof summary !== "object" || summary === null) {
    throw new Error(`Coverage evidence is not an object: ${sourcePath}`);
  }

  const candidate = summary as CoverageSummary;
  const total = candidate.total;
  const metrics = ["lines", "statements", "functions", "branches"] as const;
  if (total === undefined) {
    throw new Error(`Coverage evidence has no total: ${sourcePath}`);
  }

  const totals = Object.fromEntries(
    metrics.map((metric) => {
      const value = total[metric]?.total;
      if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new Error(
          `Coverage evidence has empty ${metric} denominator in ${sourcePath}`,
        );
      }
      return [metric, value];
    }),
  ) as CoverageEvidence["totals"];

  const filePaths = Object.keys(candidate).filter((key) => key !== "total");
  const invalidFilePath = filePaths.find(
    (filePath) => !isExpectedSourceFile(filePath, scope),
  );
  if (invalidFilePath !== undefined) {
    throw new Error(
      `Coverage evidence contains metadata, stray, or excluded file key ${invalidFilePath} for ${scope}: ${sourcePath}`,
    );
  }
  const fileCount = filePaths.length;
  if (fileCount <= 0) {
    throw new Error(`Coverage evidence has no file entries: ${sourcePath}`);
  }

  return { fileCount, totals };
};

const main = (): void => {
  const sourcePath = process.argv[2];
  const scope = process.argv[3];
  if (
    sourcePath === undefined ||
    (scope !== "api" && scope !== "web")
  ) {
    throw new Error(
      "Usage: coverage-evidence.ts <coverage-summary.json> <api|web>",
    );
  }
  const evidence = assertNonEmptyCoverageSummary(
    JSON.parse(readFileSync(sourcePath, "utf8")) as unknown,
    sourcePath,
    scope,
  );
  const { lines, statements, functions, branches } = evidence.totals;
  process.stdout.write(
    `coverage evidence PASS — ${sourcePath}; files=${String(evidence.fileCount)}; ` +
      `lines=${String(lines)} statements=${String(statements)} ` +
      `functions=${String(functions)} branches=${String(branches)}\n`,
  );
};

if (process.argv[1]?.endsWith("coverage-evidence.ts") === true) main();
