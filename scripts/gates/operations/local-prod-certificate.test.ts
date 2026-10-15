import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { test } from "vitest";

const openssl = realpathSync(
  execFileSync("/bin/bash", ["-c", "command -v openssl"], {
    encoding: "utf8",
  }).trim(),
);
const secretMarker = "synthetic-secret-not-for-diagnostics";
const failureMarker = "synthetic-openssl-preparation-failure";
type PairState =
  | "valid"
  | "fresh"
  | "missing-cert"
  | "missing-key"
  | "corrupt-cert"
  | "corrupt-key"
  | "mismatched";

function runSetup(pairState: PairState, failure = "", secrets?: string) {
  mkdirSync(resolve("output"), { recursive: true });
  const root = mkdtempSync(resolve("output/local-prod-certificate-"));
  const state = join(root, "state"),
    bin = join(root, "bin"),
    events = join(root, "events"),
    key = join(state, "idp.key"),
    cert = join(state, "idp.crt");
  try {
    for (const path of [state, bin]) mkdirSync(path);
    writeFileSync(
      join(state, "secrets.env"),
      secrets ??
        [
          "DB_PASSWORD",
          "AUTH_JWT_SECRET",
          "PDF_EXPORT_JWT_SECRET",
          "AI_PROVIDER_CONFIG_ENCRYPTION_KEY",
          "KC_ADMIN_PASSWORD",
          "PW_LEAD1",
          "PW_HEAD",
          "PW_VIEWER",
          "PW_ADMIN",
        ]
          .map((name) => `${name}=${secretMarker}\n`)
          .join(""),
      { mode: 0o600 },
    );
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
    const result = spawnSync(
      "/bin/bash",
      [resolve("deploy/local-prod/setup.sh")],
      {
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          STATE_DIR: state,
          NS: "synthetic-local-prod",
          KUBECONFIG: "/dev/null",
          TEST_EVENTS: events,
          TEST_OPENSSL: openssl,
          TEST_OPENSSL_FAILURE: failure,
          TEST_FAILURE_MARKER: failureMarker,
        },
      },
    );
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
      matching,
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

// C0057: an interrupted first write leaves secrets.env empty or cut short; the
// next run must refuse before Kubernetes instead of sourcing it as complete.
test.each(["", "DB_PASSWORD=ab", "DB_PASSWORD=ab\nAUTH_JWT_SECRET="])(
  "local-prod refuses an interrupted secrets.env %j before Kubernetes",
  (secrets) => {
    const { result, mutated } = runSetup("valid", "", secrets);
    assert.notEqual(result.status, 0);
    assert.equal(mutated, false);
    assert.match(result.stderr, /Missing required secret/u);
  },
);
