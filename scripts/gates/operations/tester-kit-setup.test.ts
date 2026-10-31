import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, test } from "vitest";

const setupScript = resolve("deploy/tester-kit/setup.sh");
const fixtureRoots = new Set<string>();
const fixtureRandomHex = "00112233445566778899aabbccddeeff";

afterEach(() => {
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  fixtureRoots.clear();
});

// Every external command setup.sh shells out to is a PATH stub that records its
// argv. openssl fails on the step named by FAIL_AT; kubectl must never be reached.
const writeStub = (bin: string, name: string, body: string): void => {
  const file = join(bin, name);
  writeFileSync(
    file,
    `#!/bin/sh\nprintf '%s %s\\n' '${name}' "$*" >> "$PROBE_LOG"\n${body}\n`,
  );
  chmodSync(file, 0o755);
};

const OPENSSL_STUB = `case "$1" in
  req)
    echo "openssl: req failed (stub)" >&2
    exit 1 ;;
  rand)
    if [ "$FAIL_AT" = rand4 ] && [ "$3" = 4 ]; then
      echo "openssl: rand 4 failed (stub)" >&2
      exit 1
    fi
    echo ${fixtureRandomHex} ;;
  x509|pkcs8)
    if [ "$FAIL_AT" = "$1" ]; then
      echo "openssl: $1 failed (stub)" >&2
      exit 1
    fi
    printf 'der' ;;
  *)
    echo "unexpected openssl call: $1" >&2
    exit 1 ;;
esac
exit 0`;

type FailAt = "req" | "rand4" | "x509";

const runSetup = (failAt: FailAt, existingIdp: boolean) => {
  const directory = mkdtempSync(join(tmpdir(), "tester-kit-setup-"));
  fixtureRoots.add(directory);
  const bin = join(directory, "bin");
  const stateDir = join(directory, "state");
  const probeLog = join(directory, "probe.log");
  mkdirSync(bin);
  mkdirSync(stateDir);
  writeStub(bin, "openssl", OPENSSL_STUB);
  writeStub(bin, "kubectl", "exit 0");
  // Template rendering is not under test; envsubst passes its stdin through.
  writeStub(bin, "envsubst", "cat");
  if (existingIdp) {
    writeFileSync(join(stateDir, "idp.key"), "fixture-key\n");
    writeFileSync(join(stateDir, "idp.crt"), "fixture-cert\n");
  }

  const result = spawnSync("/bin/bash", [setupScript], {
    encoding: "utf8",
    env: {
      PATH: `${bin}:/usr/bin:/bin`,
      HOME: directory,
      STATE_DIR: stateDir,
      PROBE_LOG: probeLog,
      FAIL_AT: failAt,
    },
  });
  const probe = existsSync(probeLog) ? readFileSync(probeLog, "utf8") : "";
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    probe,
    stateDir,
  };
};

test("setup.sh stops before kubectl when the IdP certificate request fails and shows the openssl error", () => {
  const run = runSetup("req", false);

  assert.notEqual(run.status, 0);
  assert.match(run.output, /openssl: req failed \(stub\)/);
  assert.doesNotMatch(run.probe, /^kubectl /m);
});

test("setup.sh stops before kubectl when one password segment fails to generate and writes no half-empty secrets", () => {
  const run = runSetup("rand4", true);

  assert.notEqual(run.status, 0);
  assert.doesNotMatch(run.probe, /^kubectl /m);
  assert.equal(existsSync(join(run.stateDir, "secrets.env")), false);
  assert.doesNotMatch(run.output, new RegExp(fixtureRandomHex));
});

test("setup.sh stops before kubectl when the IdP certificate DER export fails", () => {
  const run = runSetup("x509", true);

  assert.notEqual(run.status, 0);
  assert.match(run.output, /openssl: x509 failed \(stub\)/);
  assert.doesNotMatch(run.probe, /^kubectl /m);
});
