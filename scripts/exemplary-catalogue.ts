import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import { ESLint } from "eslint";

// A file standing on one of these has a budget switched off for it. Which block
// granted the relaxation does not matter here; that it exists does.
const BUDGET_RULES = [
  "max-lines",
  "complexity",
  "sonarjs/cognitive-complexity",
  "sonarjs/no-nested-functions",
  "@typescript-eslint/no-magic-numbers",
  "max-lines-per-function",
] as const;

const CHURN_WINDOW = "90 days ago";
const REPO_ROOT = new URL("..", import.meta.url).pathname;
const DEPCRUISE_BIN = `${REPO_ROOT}node_modules/.bin/depcruise`;

// Both commands emit far more than the 1 MiB default; this is a dev script, so
// the honest bound is "whatever it produces" rather than a guessed ceiling.
const UNBOUNDED = Number.MAX_SAFE_INTEGER;
const PERCENT = 100;
const HUB_COUNT = 10;
const COUNT_WIDTH = 3;

type Kind = "product" | "test" | "tooling" | "config";
type Class = "A" | "B" | "C" | "E" | "F";

interface Row {
  readonly file: string;
  readonly kind: Kind;
  readonly cls: Class;
  readonly suppressions: number;
  readonly relaxed: readonly string[];
  readonly fanIn: number;
  readonly churn: number;
}

const git = (args: readonly string[]): string =>
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- git's location is machine-specific and cannot be pinned to a path this repo controls; shell is not used, and every argument here is a literal
  execFileSync("git", [...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: UNBOUNDED,
  });

const classifyKind = (file: string): Kind => {
  if (/\.(test|spec)\.tsx?$/.test(file)) return "test";
  if (/^(scripts|tools|prisma|e2e)\//.test(file)) return "tooling";
  if (/\.config\.ts$/.test(file)) return "config";
  return "product";
};

// tsPreCompilationDeps is on here on purpose: a module imported only as a type
// has no runtime edge, and counting it as unreferenced would report every port
// and every type module as dead.
const readFanIn = (): ReadonlyMap<string, number> => {
  const raw = execFileSync(
    DEPCRUISE_BIN,
    [
      "apps/api/src",
      "apps/web/src",
      "packages/shared/src",
      "packages/ui/src",
      "--config",
      ".dependency-cruiser.cjs",
      "--ts-pre-compilation-deps",
      "--output-type",
      "json",
    ],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: UNBOUNDED },
  );
  const graph = JSON.parse(raw) as {
    readonly modules: readonly {
      readonly source: string;
      readonly dependents?: readonly string[];
    }[];
  };
  return new Map(
    graph.modules.map((m) => [m.source, (m.dependents ?? []).length]),
  );
};

const readChurn = (): ReadonlyMap<string, number> =>
  git(["log", `--since=${CHURN_WINDOW}`, "--name-only", "--pretty=format:"])
    .split("\n")
    .filter((line) => line !== "")
    .reduce<Map<string, number>>(
      (acc, file) => acc.set(file, (acc.get(file) ?? 0) + 1),
      new Map(),
    );

interface ResolvedConfig {
  readonly rules?: Record<string, unknown>;
}

const relaxedRules = (config: ResolvedConfig): readonly string[] =>
  BUDGET_RULES.filter((rule) => {
    const entry = config.rules?.[rule];
    // A rule entry is either a severity or [severity, ...options].
    const severity: unknown = Array.isArray(entry) ? entry[0] : entry;
    return severity === "off" || severity === 0;
  });

const classify = (
  linted: boolean,
  suppressions: number,
  relaxed: readonly string[],
  fanIn: number,
  kind: Kind,
): Class => {
  if (!linted) return "F";
  if (suppressions > 0) return "B";
  if (relaxed.length > 0) return "C";
  if (fanIn === 0 && kind === "product") return "E";
  return "A";
};

const buildRow = async (
  file: string,
  eslint: ESLint,
  fanIn: ReadonlyMap<string, number>,
  churn: ReadonlyMap<string, number>,
): Promise<Row> => {
  const source = readFileSync(`${REPO_ROOT}${file}`, "utf8");
  const config = (await eslint.calculateConfigForFile(file)) as
    ResolvedConfig | undefined;
  const relaxed = config === undefined ? [] : relaxedRules(config);
  const suppressions = (source.match(/eslint-disable/g) ?? []).length;
  const kind = classifyKind(file);
  const inbound = fanIn.get(file) ?? 0;
  return {
    file,
    kind,
    cls: classify(config !== undefined, suppressions, relaxed, inbound, kind),
    suppressions,
    relaxed,
    fanIn: inbound,
    churn: churn.get(file) ?? 0,
  };
};

const buildRows = async (): Promise<readonly Row[]> => {
  const files = git(["ls-files", "*.ts", "*.tsx"]).trim().split("\n");
  const fanIn = readFanIn();
  const churn = readChurn();
  const eslint = new ESLint({ cwd: REPO_ROOT });
  return Promise.all(files.map((file) => buildRow(file, eslint, fanIn, churn)));
};

const tally = (
  rows: readonly Row[],
  pick: (row: Row) => string,
): Record<string, number> =>
  rows.reduce<Record<string, number>>(
    (acc, row) => ({ ...acc, [pick(row)]: (acc[pick(row)] ?? 0) + 1 }),
    {},
  );

const hubLine = (row: Row): string =>
  `  fanIn=${String(row.fanIn).padStart(COUNT_WIDTH)} churn=${String(row.churn).padStart(COUNT_WIDTH)} ${row.cls} ${row.file}`;

const report = (rows: readonly Row[]): void => {
  const product = rows.filter((row) => row.kind === "product");
  const clean = product.filter((row) => row.cls === "A").length;
  const percent = ((clean / product.length) * PERCENT).toFixed(1);

  process.stdout.write(
    [
      `files            ${rows.length}`,
      `by kind          ${JSON.stringify(tally(rows, (r) => r.kind))}`,
      `by class         ${JSON.stringify(tally(rows, (r) => r.cls))}`,
      "",
      `PRODUCT ON FLOOR ${clean} / ${product.length}  (${percent}%)`,
      `suppressions     ${rows.reduce((sum, r) => sum + r.suppressions, 0)}`,
      "",
      "hubs (product, by fan-in)",
      ...product
        .toSorted((a, b) => b.fanIn - a.fanIn)
        .slice(0, HUB_COUNT)
        .map(hubLine),
      "",
    ].join("\n"),
  );
};

const rows = await buildRows();
writeFileSync(
  `${REPO_ROOT}catalogue.json`,
  `${JSON.stringify(rows, undefined, 1)}\n`,
);
report(rows);
