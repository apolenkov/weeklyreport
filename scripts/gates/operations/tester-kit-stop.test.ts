import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { test } from "vitest";

test.each([
  ["shared-staging", "wr-tester", false],
  ["orbstack", "kube-system", false],
  ["orbstack", "wr-other", false],
  ["orbstack", "wr-tester", true],
  ["docker-desktop", "wr-tester-2", true],
] as const)(
  "stop admits context %s namespace %s: %s",
  (context, namespace, admitted) => {
    mkdirSync(resolve("output"), { recursive: true });
    const fixture = mkdtempSync(resolve("output/d37-v09-stop-"));
    const log = join(fixture, "kubectl.log");
    writeFileSync(
      join(fixture, "kubectl"),
      String.raw`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$WR_TEST_KUBECTL_LOG"
if [ "$*" = 'config current-context' ]; then
  printf '%s\n' "$WR_TEST_CONTEXT"
fi
`,
      { mode: 0o700 },
    );
    try {
      const result = spawnSync(
        "/bin/bash",
        [resolve("deploy/tester-kit/stop.sh"), "--yes"],
        {
          encoding: "utf8",
          timeout: 2000,
          env: {
            ...process.env,
            PATH: `${fixture}:${process.env.PATH ?? ""}`,
            KUBECONFIG: "/dev/null",
            STATE_DIR: fixture,
            NS: namespace,
            WR_TEST_KUBECTL_LOG: log,
            WR_TEST_CONTEXT: context,
          },
        },
      );
      const calls = readFileSync(log, "utf8").trim().split("\n");
      if (!admitted) {
        assert.notEqual(
          result.status,
          0,
          "unsafe target must fail before resource access",
        );
        assert.deepEqual(calls, ["config current-context"]);
        return;
      }
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(calls, [
        "config current-context",
        `--context=${context} get namespace ${namespace}`,
        `--context=${context} delete namespace ${namespace} --wait=true`,
      ]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);
