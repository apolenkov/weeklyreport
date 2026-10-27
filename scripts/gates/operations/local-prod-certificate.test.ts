import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { test } from "vitest";

function resolveCommand(name: string) {
  return realpathSync(
    execFileSync("/bin/bash", ["-c", `command -v ${name}`], {
      encoding: "utf8",
    }).trim(),
  );
}

const openssl = resolveCommand("openssl");
const cat = resolveCommand("cat");
const secretMarker = "synthetic-secret-not-for-diagnostics";
const failureMarker = "synthetic-openssl-preparation-failure";
const requiredSecretNames = [
  "DB_PASSWORD",
  "AUTH_JWT_SECRET",
  "PDF_EXPORT_JWT_SECRET",
  "AI_PROVIDER_CONFIG_ENCRYPTION_KEY",
  "KC_ADMIN_PASSWORD",
  "PW_LEAD1",
  "PW_HEAD",
  "PW_VIEWER",
  "PW_ADMIN",
] as const;
// Values the setup script generates with `openssl rand -hex`; a truncated
// secret cannot match its complete shape.
const secretShapes: Readonly<
  Record<(typeof requiredSecretNames)[number], RegExp>
> = {
  DB_PASSWORD: /^[0-9a-f]{32}$/u,
  AUTH_JWT_SECRET: /^[0-9a-f]{64}$/u,
  PDF_EXPORT_JWT_SECRET: /^[0-9a-f]{64}$/u,
  AI_PROVIDER_CONFIG_ENCRYPTION_KEY: /^[0-9a-f]{64}$/u,
  KC_ADMIN_PASSWORD: /^[0-9a-f]{24}$/u,
  PW_LEAD1: /^Wr-lead1-[0-9a-f]{8}$/u,
  PW_HEAD: /^Wr-head-[0-9a-f]{8}$/u,
  PW_VIEWER: /^Wr-viewer-[0-9a-f]{8}$/u,
  PW_ADMIN: /^Wr-admin-[0-9a-f]{8}$/u,
};

function parseSecrets(contents: string) {
  return Object.fromEntries(
    contents
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

interface SetupRunOptions {
  // Holds the writer mid-heredoc: only a prefix of the last value reaches the
  // file, then the process exits as interrupted.
  readonly interruptSecretsWrite?: boolean;
  // Runs setup again after the first run finishes.
  readonly rerun?: boolean;
  // Invokes setup from the fixture root with a relative STATE_DIR.
  readonly relativeStateDir?: boolean;
}
type PairState =
  | "valid"
  | "fresh"
  | "missing-cert"
  | "missing-key"
  | "corrupt-cert"
  | "corrupt-key"
  | "mismatched";

function runSetup(
  pairState: PairState,
  failure = "",
  secrets?: string | null,
  options: SetupRunOptions = {},
) {
  mkdirSync(resolve("output"), { recursive: true });
  const root = mkdtempSync(resolve("output/local-prod-certificate-"));
  const state = join(root, "state"),
    bin = join(root, "bin"),
    events = join(root, "events"),
    secretsPath = join(state, "secrets.env"),
    key = join(state, "idp.key"),
    cert = join(state, "idp.crt");
  try {
    for (const path of [state, bin]) mkdirSync(path);
    const initialSecrets =
      secrets === undefined
        ? requiredSecretNames
            .map((name) => `${name}=${secretMarker}\n`)
            .join("")
        : secrets;
    if (initialSecrets !== null)
      writeFileSync(secretsPath, initialSecrets, { mode: 0o600 });
    if (pairState !== "fresh") {
      execFileSync(
        openssl,
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-days",
          "1",
          "-subj",
          "/CN=synthetic-local-stand",
          "-keyout",
          key,
          "-out",
          cert,
        ],
        { stdio: "ignore" },
      );
    }
    if (pairState === "missing-cert") rmSync(cert);
    if (pairState === "missing-key") rmSync(key);
    if (pairState === "corrupt-cert")
      writeFileSync(cert, "invalid certificate\n");
    if (pairState === "corrupt-key")
      writeFileSync(key, "invalid private key\n");
    if (pairState === "mismatched") {
      execFileSync(
        openssl,
        [
          "genpkey",
          "-algorithm",
          "RSA",
          "-pkeyopt",
          "rsa_keygen_bits:2048",
          "-out",
          key,
        ],
        { stdio: "ignore" },
      );
    }
    const beforeKey = existsSync(key) ? readFileSync(key, "utf8") : null;
    const beforeCert = existsSync(cert) ? readFileSync(cert, "utf8") : null;
    const stub = (name: string, body: string) =>
      writeFileSync(
        join(bin, name),
        `#!/bin/bash\nset -euo pipefail\n${body}\n`,
        {
          mode: 0o700,
        },
      );
    stub("envsubst", "cat");
    stub(
      "cat",
      `if [ "\${TEST_INTERRUPT_SECRETS_WRITE:-}" = "1" ]; then
  data=$("$TEST_CAT")
  printf '%s' "\${data%????}"
  exit 137
fi
exec "$TEST_CAT" "$@"`,
    );
    stub(
      "kubectl",
      String.raw`printf 'mutation\n' >> "$TEST_EVENTS"
case "$*" in *'apply -f -'*) cat >/dev/null ;; esac`,
    );
    stub(
      "openssl",
      `if [ "$1" = "$TEST_OPENSSL_FAILURE" ] && [[ "$*" != *'-pubkey'* ]]; then
  echo "$TEST_FAILURE_MARKER" >&2
  exit 42
fi
exec "$TEST_OPENSSL" "$@"`,
    );
    const runDirectory =
      options.relativeStateDir === true ? root : process.cwd();
    const runStateDir = options.relativeStateDir === true ? "state" : state;
    const runOnce = (interruptSecretsWrite: boolean) =>
      spawnSync("/bin/bash", [resolve("deploy/local-prod/setup.sh")], {
        cwd: runDirectory,
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          STATE_DIR: runStateDir,
          NS: "synthetic-local-prod",
          KUBECONFIG: "/dev/null",
          TEST_EVENTS: events,
          TEST_OPENSSL: openssl,
          TEST_OPENSSL_FAILURE: failure,
          TEST_FAILURE_MARKER: failureMarker,
          TEST_CAT: cat,
          ...(interruptSecretsWrite
            ? { TEST_INTERRUPT_SECRETS_WRITE: "1" }
            : {}),
        },
      });
    const result = runOnce(options.interruptSecretsWrite === true);
    const secretsAfterFirstRun = existsSync(secretsPath)
      ? readFileSync(secretsPath, "utf8")
      : null;
    const rerun = options.rerun === true ? runOnce(false) : null;
    const publishedSecrets = existsSync(secretsPath)
      ? readFileSync(secretsPath, "utf8")
      : null;
    const afterKey = existsSync(key) ? readFileSync(key, "utf8") : null;
    const afterCert = existsSync(cert) ? readFileSync(cert, "utf8") : null;
    const matching =
      (pairState === "valid" || pairState === "fresh") &&
      result.status === 0 &&
      execFileSync(openssl, ["x509", "-in", cert, "-pubkey", "-noout"], {
        encoding: "utf8",
      }) ===
        execFileSync(openssl, ["pkey", "-in", key, "-pubout"], {
          encoding: "utf8",
        });
    return {
      result,
      rerun,
      matching,
      secretsAfterFirstRun,
      publishedSecrets,
      publishedSecretsMode:
        publishedSecrets === null ? null : statSync(secretsPath).mode & 0o777,
      unchanged: beforeKey === afterKey && beforeCert === afterCert,
      mutated: existsSync(events),
      certificateExported:
        existsSync(join(state, "idp-cert.b64")) &&
        readFileSync(join(state, "idp-cert.b64"), "utf8").length > 0,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test.each([
  "missing-cert",
  "missing-key",
  "corrupt-cert",
  "corrupt-key",
  "mismatched",
] as const)(
  "local-prod rejects %s before Kubernetes without replacing identity",
  (pairState) => {
    const { result, mutated, unchanged } = runSetup(pairState);
    assert.notEqual(result.status, 0);
    assert.equal(mutated, false);
    assert.equal(unchanged, true);
    assert.match(result.stderr, /idp\.(crt|key)/u);
    assert.ok(!`${result.stdout}${result.stderr}`.includes(secretMarker));
    assert.ok(
      !`${result.stdout}${result.stderr}`.includes("BEGIN PRIVATE KEY"),
    );
  },
);

test.each(["valid", "fresh"] as const)(
  "local-prod deploys with a %s matching identity",
  (pairState) => {
    const { result, mutated, unchanged, matching, certificateExported } =
      runSetup(pairState);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(mutated, true);
    assert.equal(matching, true);
    assert.equal(certificateExported, true);
    if (pairState === "valid") assert.equal(unchanged, true);
  },
);

test("local-prod publishes fresh secrets under a relative STATE_DIR", () => {
  const { result, mutated, publishedSecrets, publishedSecretsMode } = runSetup(
    "fresh",
    "",
    null,
    { relativeStateDir: true },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(mutated, true);
  assert.equal(publishedSecretsMode, 0o600);
  const published = parseSecrets(publishedSecrets ?? "");
  for (const name of requiredSecretNames)
    assert.match(published[name] ?? "", secretShapes[name], name);
});

test.each(["req", "x509", "pkcs8"])(
  "local-prod propagates %s errors and stderr before Kubernetes",
  (operation) => {
    const { result, mutated } = runSetup(
      operation === "req" ? "fresh" : "valid",
      operation,
    );
    assert.equal(result.status, 42);
    assert.match(result.stderr, new RegExp(failureMarker, "u"));
    assert.equal(mutated, false);
  },
);

// A pre-existing empty or key-truncated secrets.env is refused before
// Kubernetes. These fixtures seed the file directly and do not exercise the
// writer.
test.each(["", "DB_PASSWORD=ab", "DB_PASSWORD=ab\nAUTH_JWT_SECRET="])(
  "local-prod refuses an interrupted secrets.env %j before Kubernetes",
  (secrets) => {
    const { result, mutated } = runSetup("valid", "", secrets);
    assert.notEqual(result.status, 0);
    assert.equal(mutated, false);
    assert.match(result.stderr, /Missing required secret/u);
  },
);

test("local-prod repairs a secrets.env interrupted mid-write on the next run", () => {
  const {
    result,
    rerun,
    mutated,
    secretsAfterFirstRun,
    publishedSecrets,
    publishedSecretsMode,
  } = runSetup("valid", "", null, { interruptSecretsWrite: true, rerun: true });
  assert.notEqual(
    result.status,
    0,
    "the interrupted writer must abort its run",
  );
  assert.equal(
    secretsAfterFirstRun,
    null,
    "the interrupted writer left a partial secrets.env",
  );
  assert.ok(rerun, "the fixture must run setup again after the interruption");
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.equal(mutated, true);
  assert.equal(publishedSecretsMode, 0o600);
  const published = parseSecrets(publishedSecrets ?? "");
  for (const name of requiredSecretNames)
    assert.match(published[name] ?? "", secretShapes[name], name);
});
