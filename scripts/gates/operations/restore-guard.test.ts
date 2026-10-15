import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, test } from "vitest";

const restoreScript = resolve("deploy/postgres/restore.sh");
const fixtureRoots = new Set<string>();

afterEach(() => {
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  fixtureRoots.clear();
});

test("backup image restore entrypoint is executable", () => {
  assert.notEqual(statSync(restoreScript).mode & 0o111, 0);
});

function runRestore(
  overrides: NodeJS.ProcessEnv = {},
  options: { dumpName?: string; dumpArg?: string } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "restore-guard-"));
  fixtureRoots.add(directory);
  const log = join(directory, "pg-restore.log");
  const fakeRestore = join(directory, "pg_restore");
  const dumpFile = join(directory, options.dumpName ?? "backup.dump");
  writeFileSync(dumpFile, "test archive placeholder");
  const dump = options.dumpArg ?? dumpFile;
  writeFileSync(
    fakeRestore,
    '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$PG_RESTORE_LOG"\n' +
      'if [ "$1" = "--list" ] && [ "$FAIL_ARCHIVE_LIST" = "yes" ]; then exit 1; fi\n',
  );
  chmodSync(fakeRestore, 0o755);
  const passwordVariable = ["PG", "PASSWORD"].join("");
  const fixtureSecret = randomUUID();
  const env = {
    PG_RESTORE_LOG: log,
    PG_RESTORE_BIN: fakeRestore,
    RESTORE_ENVIRONMENT: "test",
    PGHOST: "db.internal",
    PGPORT: "5432",
    PGUSER: "restore-user",
    [passwordVariable]: fixtureSecret,
    PGDATABASE: "weeklyreport_test",
    CONFIRM_RESTORE_TARGET: "test|db.internal|5432|weeklyreport_test",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
    ...overrides,
  };
  const result = spawnSync("/bin/sh", [restoreScript, dump], {
    env,
    cwd: options.dumpArg ? directory : undefined,
    encoding: "utf8",
  });
  const calls = (() => {
    try {
      return readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  })();
  return { calls, fixtureSecret, result };
}

test("wrong host, port, or database confirmation executes nothing", () => {
  for (const confirmation of [
    "test|other.internal|5432|weeklyreport_test",
    "test|db.internal|6432|weeklyreport_test",
    "test|db.internal|5432|other_test",
  ]) {
    const { calls, result } = runRestore({
      CONFIRM_RESTORE_TARGET: confirmation,
    });
    assert.equal(result.status, 3);
    assert.deepEqual(calls, []);
  }
});

test("invalid host, port, or database executes nothing", () => {
  for (const overrides of [
    { PGHOST: "db.internal user" },
    { PGPORT: "70000" },
    { PGDATABASE: "weeklyreport/test" },
  ]) {
    const { calls, result } = runRestore(overrides);
    assert.equal(result.status, 2);
    assert.deepEqual(calls, []);
  }
});

test("missing environment and malformed confirmation execute nothing", () => {
  const missing = runRestore({ RESTORE_ENVIRONMENT: "" });
  assert.equal(missing.result.status, 2);
  assert.deepEqual(missing.calls, []);

  const malformed = runRestore({ CONFIRM_RESTORE_TARGET: "yes" });
  assert.equal(malformed.result.status, 3);
  assert.deepEqual(malformed.calls, []);
});

test("undeployed environment labels execute nothing", () => {
  for (const environment of ["development", "uat", "staging"]) {
    const { calls, result } = runRestore({
      RESTORE_ENVIRONMENT: environment,
      CONFIRM_RESTORE_TARGET: `${environment}|db.internal|5432|weeklyreport_test`,
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown RESTORE_ENVIRONMENT/);
    assert.deepEqual(calls, []);
  }
});

test("missing or incorrect per-run consent executes nothing", () => {
  for (const consent of ["", "yes"]) {
    const { calls, result } = runRestore({
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: consent,
    });
    assert.equal(result.status, 3);
    assert.match(result.stderr, /explicit per-run destructive consent/);
    assert.deepEqual(calls, []);
  }
});

test("production requires the existing destructive consent", () => {
  const { calls, result } = runRestore({
    RESTORE_ENVIRONMENT: "production",
    CONFIRM_RESTORE_TARGET: "production|db.internal|5432|weeklyreport_test",
  });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /ALLOW_PROD_DESTRUCTIVE=yes/);
  assert.deepEqual(calls, []);
});

test("archive validation precedes one non-production restore", () => {
  const { calls, fixtureSecret, result } = runRestore();
  assert.equal(result.status, 0);
  assert.equal(calls.length, 2);
  assert.match(calls[0] ?? "", /^--list /);
  assert.match(calls[1] ?? "", /--host=db\.internal/);
  assert.match(calls[1] ?? "", /--port=5432/);
  assert.match(calls[1] ?? "", /--dbname=weeklyreport_test/);
  assert.match(calls[1] ?? "", /--single-transaction/);
  assert.ok(!(result.stdout + result.stderr).includes(fixtureSecret));
});

test("fully consented production restore runs once after validation", () => {
  const { calls, result } = runRestore({
    RESTORE_ENVIRONMENT: "Production",
    PGHOST: "DB.INTERNAL.",
    PGDATABASE: "WEEKLYREPORT_TEST",
    CONFIRM_RESTORE_TARGET: "production|db.internal|5432|weeklyreport_test",
    ALLOW_PROD_DESTRUCTIVE: "yes",
  });
  assert.equal(result.status, 0);
  assert.equal(calls.length, 2);
  assert.match(calls[0] ?? "", /^--list /);
  assert.match(calls[1] ?? "", /--clean/);
});

test("an unreadable archive never reaches the destructive command", () => {
  const { calls, result } = runRestore({ FAIL_ARCHIVE_LIST: "yes" });
  assert.equal(result.status, 4);
  assert.equal(calls.length, 1);
  assert.match(calls[0] ?? "", /^--list /);
});

test("a dash-leading dump argument stays a positional archive operand", () => {
  const { calls, result } = runRestore(
    {},
    { dumpName: "--dbname=other", dumpArg: "--dbname=other" },
  );
  assert.equal(result.status, 0);
  assert.equal(calls.length, 2);
  assert.match(calls[0] ?? "", /^--list -- --dbname=other$/);
  assert.match(calls[1] ?? "", / -- --dbname=other$/);
});

test("a ./-prefixed dump path is passed through unchanged", () => {
  const { calls, result } = runRestore(
    {},
    { dumpName: "--dbname=other", dumpArg: "./--dbname=other" },
  );
  assert.equal(result.status, 0);
  assert.equal(calls[0], "--list -- ./--dbname=other");
});
