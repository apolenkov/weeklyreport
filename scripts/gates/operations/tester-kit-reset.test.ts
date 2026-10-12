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

function resetFixture(options: {
  replicas?: string;
  captureExit?: number;
  operationExit?: number;
  restoreExit?: number;
  scaleExit?: number;
  forwardFailure?: boolean;
  password?: string;
}) {
  mkdirSync(resolve("output"), { recursive: true });
  const root = mkdtempSync(resolve("output/d37-f07-reset-"));
  const here = join(root, "deploy/tester-kit");
  const bin = join(root, "bin");
  const state = join(root, "state");
  const events = join(root, "events");
  for (const path of [
    here,
    bin,
    state,
    join(root, "node_modules"),
    join(root, "apps/api"),
  ])
    mkdirSync(path, { recursive: true });
  for (const file of ["reset.sh", "env.sh", "guard.sh"])
    copyFileSync(resolve("deploy/tester-kit", file), join(here, file));
  writeFileSync(join(here, "post-seed.sql"), "SELECT 1;\n");
  writeFileSync(
    join(state, "secrets.env"),
    `DB_PASSWORD='${options.password ?? "fixture-db"}'\n`,
    { mode: 0o600 },
  );
  const stub = (name: string, body: string) =>
    writeFileSync(
      join(bin, name),
      `#!/bin/bash\nset -euo pipefail\n${body}\n`,
      { mode: 0o700 },
    );
  stub(
    "kubectl",
    String.raw`
printf 'kubectl %s\n' "$*" >> "$TEST_EVENTS"
case "$*" in
  'config current-context') printf 'orbstack\n' ;;
  *'get deploy/api'*'jsonpath'*) printf '%s\n' "$TEST_REPLICAS"; exit "$TEST_CAPTURE_EXIT" ;;
  *'scale deploy/api'*)
    case "$*" in *'--replicas=0'*) exit "$TEST_SCALE_EXIT" ;; *) exit "$TEST_RESTORE_EXIT" ;; esac ;;
  *'port-forward'*)
    printf 'PF_BIND_REFUSED\n' >&2
    if [ "$TEST_FORWARD_FAILURE" = 1 ]; then exit 7; fi
    exec "$TEST_NODE" -e 'setTimeout(() => {}, 30000)' ;;
esac`,
  );
  stub(
    "pnpm",
    String.raw`printf 'pnpm %s\n' "$*" >> "$TEST_EVENTS"
case "$*" in *'prisma/operations/migrate-reset.ts'*) exit "$TEST_OPERATION_EXIT" ;; esac`,
  );
  stub(
    "lsof",
    `count=0; [ ! -f "$TEST_STATE/lsof-count" ] || count=$(cat "$TEST_STATE/lsof-count")
count=$((count + 1)); printf '%s' "$count" > "$TEST_STATE/lsof-count"
[ "$count" -gt 2 ] && [ "$TEST_FORWARD_FAILURE" = 0 ]`,
  );
  stub("sleep", "/bin/sleep 0.01");
  try {
    const result = spawnSync("/bin/bash", [join(here, "reset.sh"), "--yes"], {
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        STATE_DIR: state,
        NS: "wr-tester",
        KUBECONFIG: "/dev/null",
        WR_TESTER_LOCK_OWNER: undefined,
        WR_PRE_RESET_HOOK: "",
        WR_POST_RESET_HOOK: "",
        TEST_EVENTS: events,
        TEST_STATE: state,
        TEST_NODE: process.execPath,
        TEST_REPLICAS: options.replicas ?? "3",
        TEST_CAPTURE_EXIT: String(options.captureExit ?? 0),
        TEST_OPERATION_EXIT: String(options.operationExit ?? 0),
        TEST_RESTORE_EXIT: String(options.restoreExit ?? 0),
        TEST_SCALE_EXIT: String(options.scaleExit ?? 0),
        TEST_FORWARD_FAILURE: options.forwardFailure ? "1" : "0",
      },
    });
    const calls = existsSync(events) ? readFileSync(events, "utf8") : "";
    const logs = Object.fromEntries(
      ["pf-reset-postgres.log", "pf-reset-redis.log"].map((name) => [
        name,
        existsSync(join(state, name))
          ? readFileSync(join(state, name), "utf8")
          : null,
      ]),
    );
    return {
      result,
      calls,
      logs,
      unlocked: !existsSync(join(state, "mutation.lock")),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test.each([0, 31])(
  "reset restores captured three replicas after operation exit %s",
  (operationExit) => {
    const { result, calls, unlocked } = resetFixture({
      replicas: "3",
      operationExit,
    });
    assert.equal(result.status, operationExit, result.stderr);
    assert.match(calls, /get deploy\/api.*jsonpath/u);
    assert.match(calls, /scale deploy\/api --replicas=0/u);
    assert.match(calls, /scale deploy\/api --replicas=3/u);
    assert.doesNotMatch(calls, /scale deploy\/api --replicas=1/u);
    assert.equal(unlocked, true);
  },
);

test.each(["", "invalid", "-1"])(
  "reset refuses invalid replica prestate %j before scale",
  (replicas) => {
    const { result, calls, unlocked } = resetFixture({ replicas });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(calls, /scale deploy\/api/u);
    assert.equal(unlocked, true);
  },
);

test("failed replica read does not scale and releases owned lock", () => {
  const { result, calls, unlocked } = resetFixture({ captureExit: 17 });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(calls, /scale deploy\/api/u);
  assert.equal(unlocked, true);
});

test("failed forward retains its marker in a private log and blocks migrate", () => {
  const { result, calls, logs, unlocked } = resetFixture({
    forwardFailure: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(logs["pf-reset-postgres.log"] ?? "", /PF_BIND_REFUSED/u);
  assert.match(result.stderr, /postgres.*pf-reset-postgres\.log/u);
  assert.doesNotMatch(calls, /prisma\/operations\/migrate-reset\.ts/u);
  assert.equal(unlocked, true);
});

test("empty reset password refuses before preparation and scale", () => {
  const { result, calls, unlocked } = resetFixture({ password: "" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DB_PASSWORD/u);
  assert.doesNotMatch(calls, /db:generate|scale deploy\/api/u);
  assert.equal(unlocked, true);
});

test("restore failure remains nonzero and releases lock", () => {
  const { result, unlocked } = resetFixture({ restoreExit: 19 });
  assert.notEqual(result.status, 0);
  assert.equal(unlocked, true);
});

test.each(["0", "1"])(
  "reset preserves captured %s replica intent",
  (replicas) => {
    const { result, calls, unlocked } = resetFixture({ replicas });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      calls
        .split("\n")
        .filter((call) =>
          call.includes(`scale deploy/api --replicas=${replicas}`),
        ).length,
      replicas === "0" ? 2 : 1,
    );
    if (replicas === "0") assert.doesNotMatch(calls, /rollout status/u);
    assert.equal(unlocked, true);
  },
);

test("ambiguous scale-down failure still restores captured replicas", () => {
  const { result, calls, unlocked } = resetFixture({ scaleExit: 23 });
  assert.equal(result.status, 23, result.stderr);
  assert.match(calls, /scale deploy\/api --replicas=3/u);
  assert.doesNotMatch(calls, /prisma\/operations\/migrate-reset\.ts/u);
  assert.equal(unlocked, true);
});
