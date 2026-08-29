import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const backupScript = resolve("deploy/postgres/backup-loop.sh");
const fixtureCredential = "fixture-only";

const runBackup = (overrides: NodeJS.ProcessEnv) => {
  const directory = mkdtempSync(join(tmpdir(), "backup-loop-"));
  const probeLog = join(directory, "probe.log");
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const path = process.env.PATH;
  assert.ok(path);
  const stub = (name: string, body: string): void => {
    const file = join(bin, name);
    writeFileSync(
      file,
      `#!/bin/sh\nprintf '%s\\n' '${name}' >> '${probeLog}'\n${body}\n`,
    );
    chmodSync(file, 0o755);
  };
  // If validation regresses, these stubs turn the retry loop into a hot loop;
  // the spawn timeout then makes that regression observable.
  stub("pg_dump", "exit 1");
  stub("sleep", "exit 0");
  const result = spawnSync("/bin/sh", [backupScript], {
    env: {
      ...process.env,
      PATH: `${bin}:${path}`,
      PGHOST: "postgres",
      PGUSER: "backup",
      PGPASSWORD: fixtureCredential,
      PGDATABASE: "customreport",
      BACKUP_DIR: join(directory, "backups"),
      BACKUP_INTERVAL_SECONDS: "3600",
      BACKUP_RETENTION_DAYS: "14",
      ...overrides,
    },
    encoding: "utf8",
    timeout: 500,
  });
  let calls = "";
  try {
    calls = readFileSync(probeLog, "utf8");
  } catch {
    // Validation should fail before any external command is called.
  }
  return { calls, result };
};

void test("rejects empty, zero, negative, and non-numeric backup settings", () => {
  for (const variable of ["BACKUP_INTERVAL_SECONDS", "BACKUP_RETENTION_DAYS"]) {
    for (const value of ["", "0", "-1", "1.5", "not-a-number"]) {
      const { calls, result } = runBackup({ [variable]: value });
      assert.equal(result.signal, null, `${variable}=${value} timed out`);
      assert.notEqual(result.status, 0, `${variable}=${value} was accepted`);
      assert.match(
        `${result.stdout}${result.stderr}`,
        /must be (a )?positive integer|required|parameter not set/,
      );
      assert.equal(calls, "", `${variable}=${value} reached the loop`);
    }
  }
});
