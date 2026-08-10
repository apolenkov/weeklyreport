import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface CycleBaseline {
  readonly cycles: number;
}

interface CruiseViolation {
  readonly rule: {
    readonly name: string;
  };
}

interface CruiseResult {
  readonly summary: {
    readonly violations: readonly CruiseViolation[];
  };
}

const CYCLE_RULE = "no-circular";

export const parseCycleBaseline = (raw: string): CycleBaseline => {
  const value = JSON.parse(raw) as Partial<CycleBaseline>;
  if (!Number.isInteger(value.cycles) || (value.cycles ?? -1) < 0)
    throw new Error("Invalid type-cycle baseline");
  return value as CycleBaseline;
};

export const cycleRatchetViolations = (
  current: readonly CruiseViolation[],
  baseline: CycleBaseline,
  previous?: CycleBaseline,
): readonly string[] => {
  const cycles = current.filter(
    (violation) => violation.rule.name === CYCLE_RULE,
  ).length;
  const unrelated = current.filter(
    (violation) => violation.rule.name !== CYCLE_RULE,
  );
  return [
    ...(cycles === baseline.cycles
      ? []
      : [
          `current type-only cycles=${cycles} does not match baseline ${baseline.cycles}`,
        ]),
    ...(previous !== undefined && baseline.cycles > previous.cycles
      ? [
          `type-cycle baseline regressed: ${previous.cycles} -> ${baseline.cycles}`,
        ]
      : []),
    ...unrelated.map(
      (violation) =>
        `type-only cruise has unrelated violation: ${violation.rule.name}`,
    ),
  ];
};

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const BASELINE_RELATIVE_PATH =
  "scripts/quality/type-cycles/type-cycle-baseline.json";
const BASELINE_PATH = `${REPO_ROOT}${BASELINE_RELATIVE_PATH}`;
const DEPCRUISE_BIN = `${REPO_ROOT}node_modules/.bin/depcruise`;
const GIT_BIN = "/usr/bin/git";
const UNBOUNDED = Number.MAX_SAFE_INTEGER;
const MAX_PROCESS_EXIT_CODE = 255;

const git = (args: readonly string[]): string => {
  const result = spawnSync(GIT_BIN, [...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: UNBOUNDED,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || `git exited ${String(result.status)}`);
  return result.stdout;
};

const previousBaseline = (): CycleBaseline | undefined => {
  const pathInParent = git([
    "ls-tree",
    "--name-only",
    "HEAD^",
    "--",
    BASELINE_RELATIVE_PATH,
  ]).trim();
  return pathInParent === ""
    ? undefined
    : parseCycleBaseline(git(["show", `HEAD^:${BASELINE_RELATIVE_PATH}`]));
};

const runCruise = (): readonly CruiseViolation[] => {
  const arguments_ = [
    "apps/api/src",
    "apps/web/src",
    "packages/shared/src",
    "packages/ui/src",
    "--config",
    ".dependency-cruiser.cjs",
    "--ts-pre-compilation-deps",
  ] as const;
  const jsonResult = spawnSync(
    DEPCRUISE_BIN,
    [...arguments_, "--output-type", "json"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: UNBOUNDED,
    },
  );
  if (jsonResult.error !== undefined) throw jsonResult.error;
  if (jsonResult.signal !== null)
    throw new Error(`dependency-cruiser was killed by ${jsonResult.signal}`);
  if (jsonResult.stdout.trim() === "")
    throw new Error(
      jsonResult.stderr ||
        `dependency-cruiser JSON exited ${String(jsonResult.status)}`,
    );

  const output = JSON.parse(jsonResult.stdout) as CruiseResult;
  const errorCount = output.summary.violations.filter(
    (violation) => violation.rule.name !== "",
  ).length;
  // The JSON reporter deliberately exits zero so callers can consume a graph.
  // Run the error reporter too and capture its status in this process; piping
  // it through tail would replace the dependency-cruiser status with tail's.
  const enforcementResult = spawnSync(DEPCRUISE_BIN, [...arguments_], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: UNBOUNDED,
  });
  if (enforcementResult.error !== undefined) throw enforcementResult.error;
  if (enforcementResult.signal !== null)
    throw new Error(
      `dependency-cruiser was killed by ${enforcementResult.signal}`,
    );
  if (enforcementResult.status !== Math.min(errorCount, MAX_PROCESS_EXIT_CODE))
    throw new Error(
      `dependency-cruiser exit ${String(enforcementResult.status)} disagrees with ${errorCount} JSON violations`,
    );
  return output.summary.violations;
};

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], "file:").href;

if (isEntrypoint) {
  const baseline = parseCycleBaseline(readFileSync(BASELINE_PATH, "utf8"));
  const violations = cycleRatchetViolations(
    runCruise(),
    baseline,
    previousBaseline(),
  );
  process.stdout.write(
    `type-cycle-ratchet ${violations.length === 0 ? "PASS" : "FAIL"} baseline=${baseline.cycles}\n`,
  );
  if (violations.length > 0) {
    process.stderr.write(`${violations.join("\n")}\n`);
    process.exitCode = 1;
  }
}
