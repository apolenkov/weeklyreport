#!/usr/bin/env node
// Runs every static-analysis check independently and reports every failure.
// Each command remains directly runnable from package.json; this file owns
// only ordering, complete execution, and the aggregate verdict.
//
// Usage (through pnpm — the gate spawns the pnpm that launched it):
//   pnpm lint              # run all, report all (CI + humans)
//   pnpm lint --fail-fast  # stop at the first failure
// Exits 0 only when every check exited 0; 1 when any failed; 2 on bad usage.
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";

interface Check {
  // package.json script name — the single place the command and its flags live.
  readonly script: string;
  readonly what: string;
}

interface Verdict {
  readonly ok: boolean;
  // Human-readable reason, always naming the exit status or signal.
  readonly detail: string;
}

interface Result extends Verdict {
  readonly script: string;
  readonly ms: number;
}

// Order is presentational — eslint first because its output is what a human is
// usually waiting for. Every entry runs regardless of what precedes it.
const CHECKS: readonly Check[] = [
  { script: "lint:eslint", what: "ESLint, zero warnings tolerated" },
  {
    script: "lint:prettier-scope:test",
    what: "Prettier maintained-file scope probes",
  },
  {
    script: "lint:stylelint-gate:test",
    what: "Stylelint zero-warning planted probe",
  },
  {
    script: "lint:config-hygiene:test",
    what: "active config archaeology and path-drift probes",
  },
  { script: "lint:stylelint", what: "stylelint over CSS" },
  { script: "lint:prisma:typecheck", what: "tsc — prisma/ project" },
  { script: "lint:scripts:typecheck", what: "tsc — scripts/ + tools/ project" },
  { script: "lint:e2e:typecheck", what: "tsc — e2e/ project" },
  {
    script: "lint:e2e-helpers:test",
    what: "E2E resource-ownership planted probes",
  },
  {
    script: "lint:uat-analysis:test",
    what: "UAT static-analysis resolver and policy tests",
  },
  { script: "typecov", what: "package-specific type-coverage ratchet" },
  {
    script: "lint:typecov:test",
    what: "type-coverage thresholds and planted escape probe",
  },
  { script: "lint:ssot-gate:test", what: "status-SSOT gate unit tests" },
  { script: "lint:ssot-gate", what: "status-SSOT re-declaration sweep" },
  { script: "lint:runtime-node", what: "Node/pnpm version drift guard" },
  {
    script: "lint:suppressions:test",
    what: "suppression inventory parser tests",
  },
  {
    script: "lint:suppressions",
    what: "live suppression adjudication ledger",
  },
  {
    script: "lint:suppressions:retained",
    what: "retained suppression planted probes",
  },
  {
    script: "lint:eslint-scopes",
    what: "ESLint scope classification and planted probes",
  },
  {
    script: "lint:eslint-config:test",
    what: "eslint-config/ module ownership probes",
  },
  {
    script: "lint:web-coverage-scope:test",
    what: "web coverage exclusion scope probes",
  },
  {
    script: "lint:react-doctor:test",
    what: "React Doctor baseline integrity probes",
  },
  {
    script: "lint:react-doctor",
    what: "React Doctor full scan against reviewed warning baseline",
  },
  {
    script: "lint:exemplary-floor:test",
    what: "exemplary-floor ratchet unit tests",
  },
  {
    script: "lint:exemplary-floor",
    what: "exemplary-floor three-counter ratchet",
  },
  {
    script: "lint:type-cycles:test",
    what: "type-only cycle ratchet unit tests",
  },
  {
    script: "lint:type-cycles",
    what: "type-only cycle debt ratchet",
  },
  {
    script: "lint:provenance:test",
    what: "live OpenSpec provenance resolver tests",
  },
  {
    script: "lint:deferred-references:test",
    what: "deferred references resolve to maintained planning records",
  },
  {
    script: "lint:vitest-rules:test",
    what: "Vitest rule ledger and planted probes",
  },
  {
    script: "lint:exact-optional:test",
    what: "exact optional properties config and planted probe",
  },
  {
    script: "lint:directory-architecture",
    what: "directory ownership, density, and source-identity ratchets",
  },
  {
    script: "lint:repository-tests",
    what: "repository-test manifest, discovery, and orphan Node tests",
  },
  {
    script: "lint:critical-tests:test",
    what: "critical-test and P0 evidence verifier tests",
  },
  {
    script: "lint:critical-tests",
    what: "manifest-owned tests have no advisory bypasses",
  },
  {
    script: "lint:p0-evidence",
    what: "current passing evidence for all accepted P0 findings",
  },
  { script: "depcruise", what: "dependency-cruiser module graph" },
  { script: "knip", what: "knip dead code and dependencies" },
];

// Banners go to fd 1 directly. `console.log` buffers when stdout is a pipe (CI),
// which lets a child's inherited output overtake the banner that introduces it.
const write = (line: string): void => {
  fs.writeSync(1, `${line}\n`);
};

const RULE_WIDTH = 72;
const RULE = "─".repeat(RULE_WIDTH);

// The pnpm that launched this gate, rather than whatever `pnpm` PATH happens to
// resolve to. Every `pnpm run` exports it, and `pnpm lint` is the only supported
// entrypoint, so an unset value is misuse and gets a loud exit — not a default.
const pnpmExecPath = process.env.npm_execpath;

const verdictOf = (outcome: SpawnSyncReturns<Buffer>): Verdict => {
  if (outcome.error !== undefined)
    return { ok: false, detail: `could not start: ${outcome.error.message}` };
  if (outcome.status === 0) return { ok: true, detail: "exit 0" };
  // A signal death (ESLint OOMs to SIGABRT) reports status null. Reading that
  // as 0 would turn the loudest possible failure into a pass.
  if (outcome.signal !== null)
    return { ok: false, detail: `killed by ${outcome.signal}` };
  return { ok: false, detail: `exit ${outcome.status ?? "unknown"}` };
};

// npm_execpath is a directly-executable launcher under a standalone install and
// a `.cjs` entry under corepack (what CI uses). Only the first can be spawned as
// a command, so the second is handed to the Node that is already running.
const launcher = (execPath: string): readonly [string, readonly string[]] =>
  /\.[cm]?js$/.test(execPath) ? [process.execPath, [execPath]] : [execPath, []];

const runCheck = (check: Check, pnpm: string): Result => {
  write(`\n${RULE}\n▶ ${check.script} — ${check.what}\n${RULE}`);
  const started = Date.now();
  const [command, leadingArgs] = launcher(pnpm);
  // `--silent` drops pnpm's own lifecycle banner; the child still inherits
  // stdout/stderr, so each tool prints its own counts exactly as before.
  const outcome = spawnSync(
    command,
    [...leadingArgs, "run", "--silent", check.script],
    { stdio: "inherit" },
  );
  return {
    script: check.script,
    ms: Date.now() - started,
    ...verdictOf(outcome),
  };
};

interface RunOptions {
  readonly pnpm: string;
  readonly stopOnFailure: boolean;
}

// Recursive rather than a loop with a mutated accumulator: the repo standard
// bans `let` and in-place mutation.
const runFrom = (
  queue: readonly Check[],
  done: readonly Result[],
  options: RunOptions,
): readonly Result[] => {
  const [next, ...rest] = queue;
  if (next === undefined) return done;
  const results = [...done, runCheck(next, options.pnpm)];
  const failed = results.some((result) => !result.ok);
  return failed && options.stopOnFailure
    ? results
    : runFrom(rest, results, options);
};

const MS_PER_SECOND = 1000;
// Summary-table column widths: verdict label, script name, elapsed time.
const LABEL_WIDTH = 5;
const SCRIPT_WIDTH = 24;
const DURATION_WIDTH = 8;

const seconds = (ms: number): string =>
  `${(ms / MS_PER_SECOND).toFixed(1)}s`.padStart(DURATION_WIDTH);

const row = (label: string, script: string, tail: string): string =>
  `  ${label.padEnd(LABEL_WIDTH)} ${script.padEnd(SCRIPT_WIDTH)} ${tail}`;

const summary = (results: readonly Result[]): readonly string[] => [
  ...results.map((result) =>
    row(
      result.ok ? "PASS" : "FAIL",
      result.script,
      `${seconds(result.ms)}  ${result.detail}`,
    ),
  ),
  ...CHECKS.slice(results.length).map((check) =>
    row("SKIP", check.script, "not run — stopped by --fail-fast"),
  ),
];

const FAIL_FAST = "--fail-fast";
const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== FAIL_FAST);

if (unknown.length > 0) {
  write(`lint-gate: unknown argument(s): ${unknown.join(" ")}`);
  write(`lint-gate: usage: pnpm lint [${FAIL_FAST}]`);
  process.exit(2);
}

if (pnpmExecPath === undefined) {
  write("lint-gate: npm_execpath is unset — run this gate as `pnpm lint`.");
  process.exit(2);
}

const results = runFrom(CHECKS, [], {
  pnpm: pnpmExecPath,
  stopOnFailure: args.includes(FAIL_FAST),
});
const failures = results.filter((result) => !result.ok);

write(`\n${RULE}\nlint gate — ${CHECKS.length} checks\n${RULE}`);
write(summary(results).join("\n"));
write(
  failures.length === 0
    ? `\nAll ${CHECKS.length} checks passed.`
    : `\n${failures.length} of ${CHECKS.length} checks FAILED: ${failures
        .map((failure) => failure.script)
        .join(", ")}`,
);

process.exit(failures.length > 0 ? 1 : 0);
