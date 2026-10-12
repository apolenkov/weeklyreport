import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { test } from "vitest";

test.each([
  [42, 0, true, 42],
  [42, 9, true, 42],
  [0, 9, true, 9],
  [42, 0, false, 42],
  [0, 0, false, 0],
] as const)(
  "quick walk crawl=%s reset=%s requested=%s preserves exit=%s",
  (crawlExit, resetExit, requested, expectedExit) => {
    mkdirSync(resolve("output"), { recursive: true });
    const fixture = mkdtempSync(resolve("output/d37-v09-walk-"));
    const here = join(fixture, "deploy/tester-kit");
    const bin = join(fixture, "bin");
    const state = join(fixture, "state");
    const events = join(fixture, "events.log");
    for (const path of [here, bin, state, join(fixture, "node_modules")]) {
      mkdirSync(path, { recursive: true });
    }
    for (const source of ["walk.sh", "env.sh"]) {
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
      String.raw`printf "crawl\n" >> "$WR_TEST_EVENTS"; exit "$WR_TEST_CRAWL_EXIT"`,
    );
    // The reset executable is only a callee boundary, never a guard/DB receipt.
    executable(
      join(here, "reset.sh"),
      String.raw`printf "reset\n" >> "$WR_TEST_EVENTS"; exit "$WR_TEST_RESET_EXIT"`,
    );
    for (const tool of ["agent-browser", "ffmpeg", "kubectl"]) {
      executable(join(bin, tool), "exit 0");
    }
    executable(join(bin, "lsof"), "exit 1");
    try {
      const result = spawnSync(
        "/bin/bash",
        [join(here, "walk.sh"), "--quick", ...(requested ? ["--reset"] : [])],
        {
          encoding: "utf8",
          timeout: 15_000,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH ?? ""}`,
            STATE_DIR: state,
            KUBECONFIG: "/dev/null",
            WR_TEST_EVENTS: events,
            WR_TEST_CRAWL_EXIT: String(crawlExit),
            WR_TEST_RESET_EXIT: String(resetExit),
          },
        },
      );
      const observed = readFileSync(events, "utf8").trim().split("\n");
      assert.deepEqual(observed, requested ? ["crawl", "reset"] : ["crawl"]);
      assert.equal(result.status, expectedExit, result.stderr);
      if (requested && resetExit !== 0) {
        assert.match(result.stderr, /reset failed/iu);
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);
