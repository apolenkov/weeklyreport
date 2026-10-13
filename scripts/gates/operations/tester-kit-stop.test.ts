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
          timeout: 15_000,
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
        `--context=${context} delete namespace ${namespace} --wait=true --timeout=120s`,
      ]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);

test.each([
  [1, 0],
  [1, 9],
  [23, 0],
  [23, 9],
  [0, 9],
  [0, 0],
] as const)(
  "stop attempts every forward cleanup after deletion %s with cleanup result %s",
  (deleteExit, cleanupExit) => {
    mkdirSync(resolve("output"), { recursive: true });
    const fixture = mkdtempSync(resolve("output/d37-f07-stop-"));
    const log = join(fixture, "cleanup.log");
    const deleteLog = join(fixture, "delete.log");
    writeFileSync(
      join(fixture, "kubectl"),
      String.raw`#!/bin/sh
case "$*" in
  'config current-context') echo orbstack ;;
  *'delete namespace'*)
    printf '%s\n' "$*" >> "$WR_DELETE_LOG"
    ${deleteExit === 1 ? 'echo "error: timed out waiting for namespace deletion" >&2' : ":"}
    exit ${deleteExit} ;;
esac
`,
      { mode: 0o700 },
    );
    writeFileSync(
      join(fixture, "rm"),
      String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$WR_CLEANUP_LOG"
exit ${cleanupExit}
`,
      { mode: 0o700 },
    );
    for (const name of ["app", "keycloak", "mailpit"])
      writeFileSync(join(fixture, `pf-${name}.pid`), "\n");
    try {
      const result = spawnSync(
        "/bin/bash",
        [resolve("deploy/tester-kit/stop.sh"), "--yes"],
        {
          encoding: "utf8",
          timeout: 15_000,
          env: {
            ...process.env,
            PATH: `${fixture}:${process.env.PATH ?? ""}`,
            STATE_DIR: fixture,
            NS: "wr-tester",
            KUBECONFIG: "/dev/null",
            WR_CLEANUP_LOG: log,
            WR_DELETE_LOG: deleteLog,
          },
        },
      );
      assert.equal(result.status, deleteExit || cleanupExit, result.stderr);
      assert.match(
        readFileSync(deleteLog, "utf8"),
        / --timeout=[1-9]\d*[smh](?:\s|$)/u,
      );
      if (deleteExit === 1) assert.match(result.stderr, /timed out/u);
      const calls = readFileSync(log, "utf8").trim().split("\n");
      assert.deepEqual(
        calls,
        ["app", "keycloak", "mailpit"].map((name) => {
          const pidfile = join(fixture, `pf-${name}.pid`);
          return `-f ${pidfile}`;
        }),
      );
      if (cleanupExit)
        for (const name of ["app", "keycloak", "mailpit"])
          assert.match(
            result.stderr,
            new RegExp(`Could not stop ${name}`, "u"),
          );
      if (deleteExit || cleanupExit)
        assert.doesNotMatch(result.stdout, /Stopped/);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);

test("cancelled stop preserves namespace and all forward records", () => {
  mkdirSync(resolve("output"), { recursive: true });
  const fixture = mkdtempSync(resolve("output/d37-f07-cancel-"));
  const log = join(fixture, "kubectl.log");
  writeFileSync(
    join(fixture, "kubectl"),
    String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$WR_CANCEL_LOG"
[ "$*" != 'config current-context' ] || echo orbstack
`,
    { mode: 0o700 },
  );
  const names = ["app", "keycloak", "mailpit"];
  for (const name of names)
    writeFileSync(join(fixture, `pf-${name}.pid`), "\n");
  try {
    const result = spawnSync(
      "/bin/bash",
      [resolve("deploy/tester-kit/stop.sh")],
      {
        input: "no\n",
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          PATH: `${fixture}:${process.env.PATH ?? ""}`,
          STATE_DIR: fixture,
          NS: "wr-tester",
          KUBECONFIG: "/dev/null",
          WR_CANCEL_LOG: log,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Cancelled/u);
    assert.doesNotMatch(readFileSync(log, "utf8"), /delete/u);
    for (const name of names)
      assert.equal(readFileSync(join(fixture, `pf-${name}.pid`), "utf8"), "\n");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
