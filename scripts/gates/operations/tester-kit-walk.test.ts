import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { test } from "vitest";

test.each([
  [42, 0, true, 42, false, undefined],
  [42, 9, true, 42, false, undefined],
  [0, 9, true, 9, false, undefined],
  [42, 0, false, 42, false, undefined],
  [0, 0, false, 0, false, undefined],
  [0, 0, false, 0, false, "separate"],
  [0, 0, false, 0, false, "equals"],
  [0, 0, false, 0, true, "separate"],
  [0, 0, false, 0, true, "equals"],
  [0, 0, false, 1, false, "empty"],
  [42, 0, false, 1, true, "separate"],
] as const)(
  "walk crawl=%s reset=%s requested=%s exit=%s full=%s output=%s",
  (crawlExit, resetExit, requested, expectedExit, full, outputForm) => {
    mkdirSync(resolve("output"), { recursive: true });
    const fixture = mkdtempSync(resolve("output/d37-v09-walk-"));
    const here = join(fixture, "deploy/tester-kit");
    const bin = join(fixture, "bin");
    const state = join(fixture, "state");
    const events = join(fixture, "events.log");
    const crawlArgs = join(fixture, "crawl-args.log");
    const mergeArgs = join(fixture, "merge-args.log");
    const output = join(fixture, "chosen output --out-text");
    for (const path of [here, bin, state, join(fixture, "node_modules")]) {
      mkdirSync(path, { recursive: true });
    }
    for (const source of ["walk.sh", "env.sh", "guard.sh"]) {
      copyFileSync(resolve("deploy/tester-kit", source), join(here, source));
    }
    writeFileSync(
      join(state, "secrets.env"),
      "# synthetic existence marker only\n",
    );
    const executable = (path: string, body: string) =>
      writeFileSync(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`, {
        mode: 0o700,
      });
    executable(
      join(bin, "node"),
      String.raw`if [ "$2" = scripts/ui-crawl/merge.ts ]; then
  printf "merge\n" >> "$WR_TEST_EVENTS"
  printf '%s\0' "$@" > "$WR_TEST_MERGE_ARGS"
else
  printf "crawl\n" >> "$WR_TEST_EVENTS"
  printf '%s\0' "$@" > "$WR_TEST_CRAWL_ARGS"
  exit "$WR_TEST_CRAWL_EXIT"
fi`,
    );
    // The reset executable is only a callee boundary, never a guard/DB receipt.
    executable(
      join(here, "reset.sh"),
      String.raw`printf "reset\n" >> "$WR_TEST_EVENTS"; exit "$WR_TEST_RESET_EXIT"`,
    );
    for (const tool of ["agent-browser", "ffmpeg"]) {
      executable(join(bin, tool), "exit 0");
    }
    executable(
      join(bin, "kubectl"),
      'if [ "$1" = config ]; then echo orbstack; fi',
    );
    executable(join(bin, "lsof"), "exit 1");
    try {
      const result = spawnSync(
        "/bin/bash",
        [
          join(here, "walk.sh"),
          ...(full
            ? ["--full", "--states", "draft", "--roles", "viewer"]
            : ["--quick"]),
          ...(requested ? ["--reset"] : []),
          ...(outputForm === "separate" ? ["--out", output] : []),
          ...(outputForm === "equals" ? [`--out=${output}`] : []),
          ...(outputForm === "empty" ? ["--out="] : []),
        ],
        {
          encoding: "utf8",
          timeout: 15_000,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH ?? ""}`,
            STATE_DIR: state,
            KUBECONFIG: "/dev/null",
            WR_TEST_EVENTS: events,
            WR_TEST_CRAWL_ARGS: crawlArgs,
            WR_TEST_MERGE_ARGS: mergeArgs,
            WR_TEST_CRAWL_EXIT: String(crawlExit),
            WR_TEST_RESET_EXIT: String(resetExit),
          },
        },
      );
      assert.equal(result.status, expectedExit, result.stderr);
      if (outputForm === "empty") {
        assert.match(result.stderr, /--out needs a value/u);
        return;
      }
      const observed = readFileSync(events, "utf8").trim().split("\n");
      assert.deepEqual(
        observed,
        full
          ? ["reset", "crawl", "merge", "reset"]
          : requested
            ? ["crawl", "reset"]
            : ["crawl"],
      );
      if (outputForm) {
        const args = readFileSync(crawlArgs, "utf8").split("\0").slice(0, -1);
        assert.equal(
          args.filter((arg) => arg === "--out" || arg.startsWith("--out="))
            .length,
          1,
        );
        assert.equal(
          args[args.indexOf("--out") + 1],
          full ? join(output, "state-draft/read") : output,
        );
        if (full) {
          // A pass that fails before writing anything still has its directory for the merge.
          assert.ok(existsSync(join(output, "state-draft/read")));
          const merged = readFileSync(mergeArgs, "utf8")
            .split("\0")
            .slice(0, -1);
          assert.equal(merged.at(-1), output);
        }
      }
      if (requested && resetExit !== 0) {
        assert.match(result.stderr, /reset failed/iu);
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
  // Above the 15 s spawn bound, so a busy host reports the shell result.
  20_000,
);
