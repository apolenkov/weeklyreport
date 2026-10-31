import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, test } from "vitest";

const backupScript = resolve("deploy/postgres/backup-loop.sh");
const backupHealthScript = resolve("deploy/postgres/backup-health.sh");
const fixtureCredential = "fixture-only";
const writerLock = ".backup-writer.lock";
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

const createBackupFixture = (
  overrides: NodeJS.ProcessEnv,
  commandStubs: BackupCommandStubs,
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
  // Hosts such as macOS lack flock(1); a silent grant keeps call logs exact.
  // Tests that exercise the lock replace it through `additional`.
  writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(bin, "flock"), 0o755);
  for (const [name, body] of Object.entries(commandStubs.additional ?? {})) {
    writeCommandStub(bin, probeLog, name, body);
  }
  const environment = (
    extraEnv: NodeJS.ProcessEnv = {},
  ): NodeJS.ProcessEnv => ({
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
    ...extraEnv,
  });
  return {
    directory,
    environment,
    probeLog,
    timeoutMs: commandStubs.timeoutMs ?? 500,
  };
};

const runBackup = (
  overrides: NodeJS.ProcessEnv,
  commandStubs: BackupCommandStubs = {},
) => {
  const { directory, environment, probeLog, timeoutMs } = createBackupFixture(
    overrides,
    commandStubs,
  );
  const runAgain = (extraEnv: NodeJS.ProcessEnv = {}) =>
    spawnSync("/bin/sh", [backupScript], {
      env: environment(extraEnv),
      encoding: "utf8",
      timeout: timeoutMs,
    });
  const result = runAgain();
  let calls = "";
  try {
    calls = readFileSync(probeLog, "utf8");
  } catch {
    // Validation should fail before any external command is called.
  }
  return { calls, directory, result, runAgain };
};

// The persistent writer lock is not a backup artifact.
const backupEntries = (directory: string): string[] =>
  readdirSync(directory).filter((name) => name !== writerLock);

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

const finiteDump = `for argument in "$@"; do
  case "$argument" in
    --file=*) output_file="$(printf '%s' "$argument" | sed 's/^--file=//')" ;;
  esac
done
printf '%s' "$BACKUP_PAYLOAD" > "$output_file"`;

test("same-second one-shot dumps preserve both complete payloads", () => {
  const { directory, result, runAgain } = runBackup(
    { ...oneShot, BACKUP_PAYLOAD: "first-finite-fixture" },
    {
      pgDump: finiteDump,
      additional: { date: String.raw`printf '%s\n' '20261013T100000Z'` },
      timeoutMs: 10_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const next = runAgain({ BACKUP_PAYLOAD: "second-finite-fixture" });
  assert.equal(next.status, 0, next.stderr);
  const backups = join(directory, "backups");
  const files = backupEntries(backups);
  assert.equal(
    files.length,
    2,
    "same-second run replaced the first complete dump",
  );
  assert.ok(files.every((file) => /^weeklyreport-.*\.dump$/.test(file)));
  assert.deepEqual(
    files.map((file) => readFileSync(join(backups, file), "utf8")).sort(),
    ["first-finite-fixture", "second-finite-fixture"],
  );
});

test("new backup directories and completed dumps exclude group and other access", () => {
  const { directory, result } = runBackup(
    { ...oneShot, BACKUP_PAYLOAD: "finite-fixture" },
    {
      pgDump: `${finiteDump}\nls -ld "$output_file"`,
      timeoutMs: 10_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const backups = join(directory, "backups");
  assert.equal(statSync(backups).mode & 0o777, 0o700);
  const [dump] = backupEntries(backups);
  assert.ok(dump);
  assert.equal(statSync(join(backups, dump)).mode & 0o777, 0o600);
  assert.match(result.stdout, /^-rw-------/m);
});

test("private dumps preserve an existing mounted directory mode", () => {
  const mounted = mkdtempSync(join(tmpdir(), "backup-mounted-"));
  fixtureRoots.add(mounted);
  chmodSync(mounted, 0o775);
  const { result } = runBackup(
    { ...oneShot, BACKUP_DIR: mounted, BACKUP_PAYLOAD: "finite-fixture" },
    {
      pgDump: `${finiteDump}\nls -ld "$output_file"`,
      timeoutMs: 10_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statSync(mounted).mode & 0o777, 0o775);
  const [dump] = backupEntries(mounted);
  assert.ok(dump);
  assert.equal(statSync(join(mounted, dump)).mode & 0o777, 0o600);
  assert.match(result.stdout, /^-rw-------/m);
});

test("temporary-file failure calls neither pg_dump nor retention", () => {
  const { calls, directory, result } = runBackup(oneShot, {
    pgDump: finiteDump,
    additional: { mktemp: "exit 1", find: "exit 99" },
    timeoutMs: 10_000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /temporary dump file could not be reserved/);
  assert.doesNotMatch(result.stdout, /wrote|pruned/);
  assert.doesNotMatch(calls, /pg_dump|find|sleep/);
  assert.deepEqual(backupEntries(join(directory, "backups")), []);
});

test("unique published names remain subject to retention and health freshness", () => {
  const { directory, result, runAgain } = runBackup(
    { ...oneShot, BACKUP_PAYLOAD: "finite-fixture" },
    {
      pgDump: finiteDump,
      timeoutMs: 10_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const backups = join(directory, "backups");
  const oldDump = join(backups, "weeklyreport-old.dump");
  const otherFile = join(backups, "other-product.dump");
  const partial = join(backups, "weeklyreport-old.partial.fixture");
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (const file of [oldDump, otherFile, partial]) {
    writeFileSync(file, "old-finite-fixture");
    utimesSync(file, old, old);
  }
  assert.equal(runAgain().status, 0);
  assert.ok(!readdirSync(backups).includes("weeklyreport-old.dump"));
  assert.equal(readFileSync(otherFile, "utf8"), "old-finite-fixture");
  assert.equal(readFileSync(partial, "utf8"), "old-finite-fixture");
  const health = () =>
    spawnSync("/bin/sh", [backupHealthScript], {
      env: {
        ...process.env,
        BACKUP_DIR: backups,
        BACKUP_INTERVAL_SECONDS: "3600",
      },
      encoding: "utf8",
      timeout: 10_000,
    });
  assert.equal(
    health().status,
    0,
    "health did not recognize a unique published dump",
  );
  for (const file of readdirSync(backups).filter(
    (file) => file.startsWith("weeklyreport-") && file.endsWith(".dump"),
  )) {
    utimesSync(join(backups, file), old, old);
  }
  utimesSync(partial, new Date(), new Date());
  assert.equal(health().status, 1, "a partial file hid stale complete dumps");
});

test("a skipped non-clobber publish fails and preserves an existing dump", () => {
  const { calls, directory, result } = runBackup(
    { ...oneShot, BACKUP_PAYLOAD: "new-finite-fixture" },
    {
      pgDump: finiteDump,
      additional: {
        mv: `for target in "$@"; do :; done
printf '%s' 'existing-finite-fixture' > "$target"
/bin/mv "$@"`,
        find: "exit 99",
      },
      timeoutMs: 10_000,
    },
  );
  assert.notEqual(
    result.status,
    0,
    "mv -n's silent skip was counted as a successful publication",
  );
  assert.match(result.stdout, /completed dump could not be published/);
  assert.doesNotMatch(result.stdout, /wrote|pruned/);
  assert.doesNotMatch(calls, /find/);
  const backups = join(directory, "backups");
  const files = backupEntries(backups);
  assert.equal(files.length, 1, "failed publication left a partial file");
  assert.equal(
    readFileSync(join(backups, files[0] ?? ""), "utf8"),
    "existing-finite-fixture",
  );
});

test("one-shot mode writes one dump, needs no interval, and never sleeps", () => {
  const { calls, directory, result } = runBackup(oneShot, {
    pgDump: dumpStub(0),
    sleep: "exit 99",
    timeoutMs: 10_000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(calls, /sleep/);
  const files = backupEntries(join(directory, "backups"));
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
  assert.deepEqual(backupEntries(join(directory, "backups")), []);
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

test("a held writer lock stops either mode before any backup work", () => {
  for (const mode of [oneShot, {}]) {
    const { calls, directory, result } = runBackup(mode, {
      pgDump: dumpStub(0),
      additional: {
        flock: 'echo "flock-args:$*" >&2\nexit 1',
        find: "exit 99",
      },
      timeoutMs: 10_000,
    });
    assert.equal(result.status, 75, result.stderr);
    assert.match(result.stderr, /^flock-args:-n 9$/m);
    assert.match(
      result.stdout,
      /another backup writer holds .*\/backups\/\.backup-writer\.lock/,
    );
    assert.equal(calls.trim(), "flock");
    assert.deepEqual(backupEntries(join(directory, "backups")), []);
  }
});

test("the writer lock is taken before the dump and outlives retention", () => {
  const { calls, directory, result, runAgain } = runBackup(oneShot, {
    // pg_dump must inherit the locked descriptor so its partial stays owned.
    pgDump: `{ : >&9; } 2>/dev/null || exit 3\n${dumpStub(0)}`,
    // A logging pass-through proves retention really ran on the second run.
    additional: { flock: "exit 0", find: 'exec /usr/bin/find "$@"' },
    timeoutMs: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.trim().split("\n"), ["flock", "pg_dump", "find"]);
  const lock = join(directory, "backups", writerLock);
  assert.equal(statSync(lock).mode & 0o777, 0o600);

  const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  utimesSync(lock, old, old);
  assert.equal(runAgain().status, 0);
  assert.equal(
    readFileSync(join(directory, "probe.log"), "utf8").match(/^find$/gm)
      ?.length,
    2,
  );
  assert.ok(statSync(lock).isFile());
});

const readProbe = (probeLog: string): string => {
  try {
    return readFileSync(probeLog, "utf8");
  } catch {
    return "";
  }
};

const waitForProbe = async (probeLog: string, name: string): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (!readProbe(probeLog).split("\n").includes(name)) {
    assert.ok(Date.now() < deadline, `${name} was never called`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  }
};

// Runs the script as the process-group leader, the way a signal reaches PID 1.
// SIGTERM goes to the script alone; the group is killed afterwards so a RED run
// cannot leave a stub `sleep` behind.
const sendTermAfterProbe = async (
  overrides: NodeJS.ProcessEnv,
  commandStubs: BackupCommandStubs,
  waitFor: string,
) => {
  const { directory, environment, probeLog } = createBackupFixture(
    overrides,
    commandStubs,
  );
  const child = spawn("/bin/sh", [backupScript], {
    env: environment(),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", (code, signal) => {
      resolveExit({ code, signal });
    });
  });
  let deadline: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, rejectExpired) => {
    deadline = setTimeout(() => {
      rejectExpired(new Error("backup did not exit within 5 s of SIGTERM"));
    }, 5_000);
  });
  try {
    await waitForProbe(probeLog, waitFor);
    child.kill("SIGTERM");
    const outcome = await Promise.race([exited, expired]);
    return {
      ...outcome,
      backups: join(directory, "backups"),
      probeLog,
      stderr,
    };
  } finally {
    clearTimeout(deadline);
    try {
      process.kill(-(child.pid ?? 0), "SIGKILL");
    } catch {
      // The group has already exited.
    }
  }
};

const blockingDump = `for argument in "$@"; do
  case "$argument" in
    --file=*) output_file="$(printf '%s' "$argument" | sed 's/^--file=//')"; : > "$output_file" ;;
  esac
done
exec /bin/sleep 60`;

test("SIGTERM during a dump exits 143 promptly and removes its partial", async () => {
  for (const mode of [oneShot, {}]) {
    const outcome = await sendTermAfterProbe(
      mode,
      { pgDump: blockingDump, sleep: "exit 99" },
      "pg_dump",
    );
    assert.equal(
      outcome.signal,
      null,
      `terminated by ${String(outcome.signal)}`,
    );
    assert.equal(outcome.code, 143, outcome.stderr);
    assert.deepEqual(backupEntries(outcome.backups), []);
  }
}, 30_000);

test("SIGTERM during the standalone interval exits 143 and keeps the published dump", async () => {
  const outcome = await sendTermAfterProbe(
    {},
    {
      pgDump: dumpStub(0),
      sleep: "exec /bin/sleep 60",
      timeoutMs: 10_000,
    },
    "sleep",
  );
  assert.equal(outcome.signal, null, `terminated by ${String(outcome.signal)}`);
  assert.equal(outcome.code, 143, outcome.stderr);
  const pgDumpCalls = readProbe(outcome.probeLog)
    .split("\n")
    .filter((line) => line === "pg_dump").length;
  assert.equal(pgDumpCalls, 1, "a second pass started after SIGTERM");
  const files = backupEntries(outcome.backups);
  assert.equal(files.length, 1);
  assert.match(files[0] ?? "", /^weeklyreport-.*\.dump$/);
}, 30_000);
