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
const backupHealthScript = resolve("deploy/postgres/backup-health.sh");
const fixtureCredential = "fixture-only";

const writeCommandStub = (
  bin: string,
  probeLog: string,
  name: string,
  body: string,
): void => {
  const file = join(bin, name);
  writeFileSync(
    file,
    `#!/bin/sh\nprintf '%s\\n' '${name}' >> '${probeLog}'\n${body}\n`,
  );
  chmodSync(file, 0o755);
};

interface BackupCommandStubs {
  readonly pgDump?: string;
  readonly sleep?: string;
  readonly additional?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

const runBackup = (
  overrides: NodeJS.ProcessEnv,
  commandStubs: BackupCommandStubs = {},
) => {
  const directory = mkdtempSync(join(tmpdir(), "backup-loop-"));
  const probeLog = join(directory, "probe.log");
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const path = process.env.PATH;
  assert.ok(path);
  // If validation regresses, these stubs turn the retry loop into a hot loop;
  // the spawn timeout then makes that regression observable.
  writeCommandStub(bin, probeLog, "pg_dump", commandStubs.pgDump ?? "exit 1");
  writeCommandStub(bin, probeLog, "sleep", commandStubs.sleep ?? "exit 0");
  for (const [name, body] of Object.entries(commandStubs.additional ?? {})) {
    writeCommandStub(bin, probeLog, name, body);
  }
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
    timeout: commandStubs.timeoutMs ?? 500,
  });
  let calls = "";
  try {
    calls = readFileSync(probeLog, "utf8");
  } catch {
    // Validation should fail before any external command is called.
  }
  return { calls, directory, result };
};

const runBackupHealth = (interval: string) => {
  const directory = mkdtempSync(join(tmpdir(), "backup-health-"));
  const probeLog = join(directory, "probe.log");
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const path = process.env.PATH;
  assert.ok(path);
  writeCommandStub(bin, probeLog, "find", "exit 99");
  const result = spawnSync("/bin/sh", [backupHealthScript], {
    env: {
      ...process.env,
      PATH: `${bin}:${path}`,
      BACKUP_DIR: directory,
      BACKUP_INTERVAL_SECONDS: interval,
    },
    encoding: "utf8",
  });
  let calls = "";
  try {
    calls = readFileSync(probeLog, "utf8");
  } catch {
    // Invalid input must fail before filesystem inspection.
  }
  return { calls, result };
};

void test("rejects empty, zero, negative, and non-numeric backup settings", () => {
  for (const variable of ["BACKUP_INTERVAL_SECONDS", "BACKUP_RETENTION_DAYS"]) {
    for (const value of ["", "0", "-1", "1.5", "not-a-number", "9999999999"]) {
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

void test("backup health rejects invalid cadence before filesystem inspection", () => {
  for (const value of ["", "0", "-1", "1.5", "not-a-number", "9999999999"]) {
    const { calls, result } = runBackupHealth(value);
    assert.equal(result.signal, null, `cadence=${value} was terminated`);
    assert.notEqual(result.status, 0, `cadence=${value} was accepted`);
    assert.match(
      `${result.stdout}${result.stderr}`,
      /must be (a )?positive integer|required|parameter not set/,
    );
    assert.equal(calls, "", `cadence=${value} reached find`);
  }
});

void test("backup health normalizes leading-zero decimal cadence before arithmetic", () => {
  const { calls, result } = runBackupHealth("08");
  assert.equal(result.signal, null);
  assert.equal(calls, "find\n");
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /arithmetic|base|value too great/i,
  );
});

void test("a failed atomic publish cannot log success or prune retention", () => {
  const { calls, result } = runBackup(
    {},
    {
      pgDump: `for argument in "$@"; do
  case "$argument" in
    --file=*) output_file="$(printf '%s' "$argument" | sed 's/^--file=//')"; : > "$output_file" ;;
  esac
done
exit 0`,
      sleep: 'kill -USR1 "$PPID"\nexit 0',
      additional: {
        mv: "exit 1",
        basename: "exit 99",
        wc: "exit 99",
        find: "exit 99",
      },
      timeoutMs: 10_000,
    },
  );

  assert.equal(result.signal, "SIGUSR1");
  assert.deepEqual(calls.trim().split("\n"), ["pg_dump", "mv", "sleep"]);
  assert.match(result.stdout, /completed dump could not be published/);
  assert.doesNotMatch(result.stdout, /wrote|pruned/);
});
