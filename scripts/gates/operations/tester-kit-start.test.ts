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

const startScript = resolve("deploy/tester-kit/start.sh");
const envScript = resolve("deploy/tester-kit/env.sh");
const fixtureSecret = "fixture-only-registry-secret";
const fixtureRoots = new Set<string>();

afterEach(() => {
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  fixtureRoots.clear();
});

// Every external command start.sh shells out to is replaced by a PATH stub that
// records its argv; cluster, registry and database behaviour is scripted
// through the environment so no real Kubernetes, Docker or psql runs.
const writeStub = (
  bin: string,
  name: string,
  body: string,
  shebang = "#!/bin/sh",
): void => {
  const file = join(bin, name);
  writeFileSync(
    file,
    `${shebang}\nprintf '%s %s\\n' '${name}' "$*" >> "$PROBE_LOG"\n${body}\n`,
  );
  chmodSync(file, 0o755);
};

// The kubectl stub parses every --from-file payload exactly the way the real
// client must accept it: strict JSON.parse of the file bytes. A document that
// is not valid JSON (e.g. raw control characters inside a string) fails the
// boundary and the stub exits non-zero like a refusing kubectl.
const KUBECTL_STUB = `case "$*" in
  *"config current-context"*) printf 'orbstack\\n' ;;
  *" exec "*"psql"*) eval "$PROBE_BEHAVIOR" ;;
  *"create "*)
    for argument in "$@"; do
      case "$argument" in
        --from-file=*)
          file="\${argument#--from-file=}"
          node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));fs.writeFileSync(process.env.CAPTURED_CFG,JSON.stringify(j));" "\${file#*=}" || exit 1
          base64 < "\${file#*=}" ;;
      esac
    done
    ;;
esac
if [ "\${1:-}" = apply ] || [ "\${3:-}" = apply ]; then cat >> "$APPLY_STDIN"; fi
exit 0`;

const runStart = (
  overrides: NodeJS.ProcessEnv,
  args: readonly string[] = [],
) => {
  const directory = mkdtempSync(join(tmpdir(), "tester-kit-start-"));
  fixtureRoots.add(directory);
  const probeLog = join(directory, "probe.log");
  const applyStdin = join(directory, "apply.stdin");
  const stateDir = join(directory, "state");
  mkdirSync(stateDir);
  writeFileSync(
    join(stateDir, "secrets.env"),
    "PW_LEAD1=a\nPW_HEAD=b\nPW_VIEWER=c\nPW_ADMIN=d\n",
  );
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const path = process.env.PATH;
  assert.ok(path);
  writeStub(bin, "kubectl", KUBECTL_STUB);
  writeStub(bin, "bash", "exit 0");
  writeStub(bin, "nohup", 'exec "$@"');
  writeStub(bin, "lsof", "exit 1");
  writeStub(bin, "curl", "printf '200'");
  for (const name of ["helm", "openssl", "envsubst", "pnpm", "docker"]) {
    writeStub(bin, name, "exit 0");
  }
  const capturedCfg = join(directory, "captured.json");
  const result = spawnSync("/bin/bash", [startScript, ...args], {
    env: {
      ...process.env,
      PATH: `${bin}:${path}`,
      PROBE_LOG: probeLog,
      APPLY_STDIN: applyStdin,
      CAPTURED_CFG: capturedCfg,
      PROBE_BEHAVIOR: String.raw`printf '0\n'`,
      STATE_DIR: stateDir,
      ...overrides,
    },
    encoding: "utf8",
    timeout: 30_000,
  });
  let calls = "";
  try {
    calls = readFileSync(probeLog, "utf8");
  } catch {
    // A start that fails before any external command leaves no probe log.
  }
  let applied = "";
  try {
    applied = readFileSync(applyStdin, "utf8");
  } catch {
    // No manifest was applied through stdin.
  }
  let captured = "";
  try {
    captured = readFileSync(capturedCfg, "utf8");
  } catch {
    // The --from-file payload never reached the stub boundary.
  }
  return { applied, calls, captured, result, stateDir };
};

test("a failed first-start User probe refuses instead of resetting", () => {
  const { calls, result } = runStart(
    {
      PROBE_BEHAVIOR: String.raw`printf "psql: connection refused\n" >&2; exit 1`,
    },
    ["--tag", "fixture-tag"],
  );
  assert.notEqual(result.status, 0, "failed probe reported success");
  assert.doesNotMatch(calls, /reset\.sh/, "failed probe ran the reset");
  assert.match(result.stderr, /psql: connection refused|refus/i);
});

test.each(["", "invalid", "-1", "0\n7"])(
  "a successful malformed User count %j refuses before reset",
  (count) => {
    const { calls, result } = runStart(
      { PROBE_BEHAVIOR: 'printf "%s" "$PROBE_COUNT"', PROBE_COUNT: count },
      ["--tag", "fixture-tag"],
    );
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(calls, /reset\.sh/);
    assert.doesNotMatch(result.stdout, /Ready/);
  },
);

test("an empty User table runs the guarded reset once", () => {
  const { calls, result } = runStart(
    { PROBE_BEHAVIOR: String.raw`printf '0\n'` },
    ["--tag", "fixture-tag"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(calls, /bash .*reset\.sh --yes/);
});

test("a populated User table skips the reset", () => {
  const { calls, result } = runStart(
    { PROBE_BEHAVIOR: String.raw`printf '7\n'` },
    ["--tag", "fixture-tag"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(calls, /reset\.sh/);
});

test("registry pull credentials stay off child argv while a pull secret applies", () => {
  const { applied, calls, result } = runStart(
    {
      REGISTRY_USER: "pull-user",
      REGISTRY_PASSWORD: fixtureSecret,
      PROBE_BEHAVIOR: String.raw`printf '3\n'`,
    },
    ["--registry", "registry.example.com/wr", "--tag", "fixture-tag"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    !calls.includes(fixtureSecret),
    "registry password reached a child command line",
  );
  assert.match(calls, /create /, "no registry secret was created");
  assert.match(calls, /apply -f -/, "no manifest was applied");
  assert.notEqual(
    applied.trim(),
    "",
    "kubectl apply received an empty manifest",
  );
});

test("credentials with JSON control characters still form a valid dockerconfig", () => {
  const user = 'pull\n"user"\tname';
  const password = 'p@ss\t"word"\nwith\\backslash';
  const { calls, captured, result, stateDir } = runStart(
    {
      REGISTRY_USER: user,
      REGISTRY_PASSWORD: password,
      PROBE_BEHAVIOR: String.raw`printf '3\n'`,
    },
    ["--registry", "registry.example.com/wr", "--tag", "fixture-tag"],
  );
  assert.equal(result.status, 0, result.stderr);
  const dockerconfig = JSON.parse(captured) as {
    auths: Record<string, { auth: string; password: string; username: string }>;
  };
  const entry = dockerconfig.auths["registry.example.com"];
  assert.ok(entry, "no auths entry for the registry host");
  assert.equal(entry.username, user);
  assert.equal(entry.password, password);
  assert.equal(
    entry.auth,
    Buffer.from(`${user}:${password}`).toString("base64"),
  );
  assert.ok(
    !calls.includes(password),
    "registry password reached a child command line",
  );
  const leftovers = readdirSync(stateDir).filter((file) =>
    file.startsWith("dockerconfigjson."),
  );
  assert.deepEqual(
    leftovers,
    [],
    "private dockerconfig temp file was not removed",
  );
});

// env.sh fixtures: pf_start/pf_stop run in a real shell against disposable
// child processes only. The kubectl stub is a long-lived script that keeps its
// argv (so ps identity checks see the recorded forward target) and reaps its
// own sleep child on TERM, so nothing leaks past the test.
const FORWARD_STUB = String.raw`sleep 45 &
child=$!
printf 'forwardchild=%s\n' "$child" >> "$PROBE_LOG"
trap 'kill "$child" 2>/dev/null' EXIT
trap 'exit 0' TERM INT
wait "$child"`;

const runEnv = (
  directory: string,
  script: string,
  overrides: NodeJS.ProcessEnv = {},
) => {
  const bin = join(directory, "bin");
  const stateDir = join(directory, "state");
  mkdirSync(bin, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  const probeLog = join(directory, "probe.log");
  const path = process.env.PATH;
  assert.ok(path);
  writeStub(bin, "nohup", 'exec "$@"');
  writeStub(bin, "lsof", "exit 1");
  const result = spawnSync("/bin/bash", ["-c", `. "$ENVSH"\n${script}`], {
    env: {
      ...process.env,
      PATH: `${bin}:${path}`,
      ENVSH: envScript,
      STATE_DIR: stateDir,
      NS: "wr-tester",
      PROBE_LOG: probeLog,
      ...overrides,
    },
    encoding: "utf8",
    timeout: 20_000,
  });
  let calls = "";
  try {
    calls = readFileSync(probeLog, "utf8");
  } catch {
    // No stub ran.
  }
  return { bin, calls, probeLog, result, stateDir };
};

const readWhen = (file: string, pattern: RegExp): string => {
  const deadline = Date.now() + 5000;
  let text = "";
  while (Date.now() < deadline) {
    try {
      text = readFileSync(file, "utf8");
    } catch {
      // Not written yet.
    }
    if (pattern.test(text)) return text;
    spawnSync("/bin/sleep", ["0.1"]);
  }
  return text;
};

const alive = (pid: number): boolean =>
  spawnSync("/bin/kill", ["-0", String(pid)]).status === 0;

// A disposable sleeper: forked by a short-lived shell, reparented, and killed
// by the test itself. It stands in for any unrelated process that may inherit
// a stale pidfile's PID after reuse.
const spawnSleeper = (): number => {
  const out = spawnSync(
    "/bin/bash",
    ["-c", "sleep 60 </dev/null >/dev/null 2>&1 & echo $!"],
    { encoding: "utf8" },
  );
  const pid = Number(out.stdout.trim());
  assert.ok(Number.isInteger(pid) && pid > 0, "sleeper did not start");
  return pid;
};

test("pf_stop does not signal a live foreign process from a mismatched pidfile", () => {
  const directory = mkdtempSync(join(tmpdir(), "tester-kit-env-"));
  fixtureRoots.add(directory);
  const { result, stateDir } = runEnv(directory, "pf_stop app");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(stateDir), []);
  const foreign = spawnSleeper();
  try {
    writeFileSync(
      join(stateDir, "pf-app.pid"),
      `${foreign}\tMon Jan  1 00:00:00 2001\tport-forward --address 127.0.0.1 svc/edge 9999:9999`,
    );
    const stop = runEnv(directory, "pf_stop app");
    assert.equal(stop.result.status, 0, stop.result.stderr);
    assert.ok(alive(foreign), "reused foreign PID was signalled");
    assert.match(stop.result.stderr, /not the recorded port-forward/i);
    assert.ok(
      !readdirSync(stateDir).includes("pf-app.pid"),
      "stale pidfile left behind",
    );
  } finally {
    spawnSync("/bin/kill", [String(foreign)]);
  }
});

test("pf_stop does not signal a live foreign process from an old-format pidfile", () => {
  const directory = mkdtempSync(join(tmpdir(), "tester-kit-env-"));
  fixtureRoots.add(directory);
  const { stateDir } = runEnv(directory, "true");
  const foreign = spawnSleeper();
  try {
    writeFileSync(join(stateDir, "pf-app.pid"), `${foreign}`);
    const stop = runEnv(directory, "pf_stop app");
    assert.equal(stop.result.status, 0, stop.result.stderr);
    assert.ok(alive(foreign), "old-format pidfile signalled a foreign PID");
  } finally {
    spawnSync("/bin/kill", [String(foreign)]);
  }
});

test("pf_start ignores a stale live PID and pf_stop reaps only the owned forward", () => {
  const directory = mkdtempSync(join(tmpdir(), "tester-kit-env-"));
  fixtureRoots.add(directory);
  const { bin, stateDir } = runEnv(directory, "true");
  writeStub(bin, "kubectl", FORWARD_STUB, "#!/bin/bash");
  const foreign = spawnSleeper();
  try {
    // Stale record: a live foreign PID with an invented identity must not
    // count as an already-running forward.
    writeFileSync(
      join(stateDir, "pf-app.pid"),
      `${foreign}\tMon Jan  1 00:00:00 2001\tport-forward --address 127.0.0.1 svc/edge 9999:9999`,
    );
    const started = runEnv(
      directory,
      'pf_start app edge 18080 8080; cat "$STATE_DIR/pf-app.pid"',
    );
    assert.equal(started.result.status, 0, started.result.stderr);
    const record = started.result.stdout.trim().split("\t");
    const recorded = Number(record[0]);
    assert.ok(
      Number.isInteger(recorded) && recorded > 0,
      started.result.stdout,
    );
    assert.notEqual(recorded, foreign, "stale PID accepted as the forward");
    assert.ok(alive(recorded), "recorded forward is not running");
    const calls = readWhen(started.probeLog, /forwardchild=\d+/);
    const forwardChild = Number(/forwardchild=(\d+)/.exec(calls)?.[1]);
    assert.ok(forwardChild > 0, "forward stub did not report its child");
    const stopped = runEnv(directory, "pf_stop app");
    assert.equal(stopped.result.status, 0, stopped.result.stderr);
    assert.equal(alive(recorded), false, "owned forward survived pf_stop");
    assert.equal(
      alive(forwardChild),
      false,
      "forward child leaked past pf_stop",
    );
    assert.ok(
      alive(foreign),
      "foreign process was signalled by owned-forward cleanup",
    );
    assert.ok(
      !readdirSync(stateDir).includes("pf-app.pid"),
      "pidfile left behind",
    );
  } finally {
    spawnSync("/bin/kill", [String(foreign)]);
  }
});
