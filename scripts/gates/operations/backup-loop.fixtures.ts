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

// Shared stubs and runners for backup-loop test files; not a test file itself.
export const backupScript = resolve("deploy/postgres/backup-loop.sh");
export const backupHealthScript = resolve("deploy/postgres/backup-health.sh");
const fixtureCredential = "fixture-only";
export const writerLock = ".backup-writer.lock";
export const fixtureRoots = new Set<string>();

export const removeFixtureRoots = (): void => {
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  fixtureRoots.clear();
};

export const writeCommandStub = (
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

export interface BackupCommandStubs {
  readonly pgDump?: string;
  readonly sleep?: string;
  readonly additional?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

export const createBackupFixture = (
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

export const runBackup = (
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
export const backupEntries = (directory: string): string[] =>
  readdirSync(directory).filter((name) => name !== writerLock);

export const oneShot = {
  BACKUP_RUN_ONCE: "true",
  BACKUP_INTERVAL_SECONDS: undefined,
};

export const finiteDump = `for argument in "$@"; do
  case "$argument" in
    --file=*) output_file="$(printf '%s' "$argument" | sed 's/^--file=//')" ;;
  esac
done
printf '%s' "$BACKUP_PAYLOAD" > "$output_file"`;
