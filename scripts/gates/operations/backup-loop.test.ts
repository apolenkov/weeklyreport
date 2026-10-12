import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, test } from "vitest";

const backupScript = resolve("deploy/postgres/backup-loop.sh");
const backupHealthScript = resolve("deploy/postgres/backup-health.sh");
const fixtureCredential = "fixture-only";
const fixtureRoots = new Set<string>();

afterEach(() => {
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  fixtureRoots.clear();
});

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
  fixtureRoots.add(directory);
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
      PGDATABASE: "weeklyreport",
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
  fixtureRoots.add(directory);
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

test("rejects empty, zero, negative, and non-numeric backup settings", () => {
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

test("backup health rejects invalid cadence before filesystem inspection", () => {
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

test("backup health normalizes leading-zero decimal cadence before arithmetic", () => {
  const { calls, result } = runBackupHealth("08");
  assert.equal(result.signal, null);
  assert.equal(calls, "find\n");
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /arithmetic|base|value too great/i,
  );
});

test("a failed atomic publish cannot log success or prune retention", () => {
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

const dumpStub = (exitCode: number): string => `for argument in "$@"; do
  case "$argument" in
    --file=*) output_file="$(printf '%s' "$argument" | sed 's/^--file=//')"; : > "$output_file" ;;
  esac
done
exit ${String(exitCode)}`;

const oneShot = { BACKUP_RUN_ONCE: "true", BACKUP_INTERVAL_SECONDS: undefined };

test("one-shot mode writes one dump, needs no interval, and never sleeps", () => {
  const { calls, directory, result } = runBackup(oneShot, {
    pgDump: dumpStub(0),
    sleep: "exit 99",
    timeoutMs: 10_000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(calls, /sleep/);
  const files = readdirSync(join(directory, "backups"));
  assert.equal(files.length, 1);
  assert.match(files[0] ?? "", /^weeklyreport-.*\.dump$/);
});

test("one-shot mode exits non-zero on a failed dump and leaves no partial file", () => {
  const { calls, directory, result } = runBackup(oneShot, {
    pgDump: dumpStub(1),
    sleep: "exit 99",
    timeoutMs: 10_000,
  });

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(calls, /sleep/);
  assert.match(result.stdout, /pg_dump did not complete/);
  assert.doesNotMatch(result.stdout, /retrying after the interval/);
  assert.deepEqual(readdirSync(join(directory, "backups")), []);
});

test("one-shot mode still requires retention and a boolean flag", () => {
  const noRetention = runBackup({ ...oneShot, BACKUP_RETENTION_DAYS: "0" });
  assert.notEqual(noRetention.result.status, 0);
  assert.equal(noRetention.calls, "");

  const badFlag = runBackup({ BACKUP_RUN_ONCE: "yes" });
  assert.notEqual(badFlag.result.status, 0);
  assert.match(badFlag.result.stderr, /BACKUP_RUN_ONCE must be true or false/);
  assert.equal(badFlag.calls, "");
});
