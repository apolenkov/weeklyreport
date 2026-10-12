import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { test } from "vitest";

const requiredKeys = [
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
const marker = "fixture-secret-value-not-diagnostic";

function setupFixture(
  owner: "tester-kit" | "local-prod",
  missing: string | null,
  empty: boolean,
) {
  mkdirSync(resolve("output"), { recursive: true });
  const root = mkdtempSync(resolve("output/d37-f07-secret-"));
  const here = join(root, "deploy", owner),
    bin = join(root, "bin"),
    state = join(root, "state"),
    events = join(root, "events");
  for (const path of [here, bin, state]) mkdirSync(path, { recursive: true });
  copyFileSync(resolve("deploy", owner, "setup.sh"), join(here, "setup.sh"));
  if (owner === "tester-kit")
    copyFileSync(resolve("deploy/tester-kit/env.sh"), join(here, "env.sh"));
  for (const name of ["idp.key", "idp.crt"])
    writeFileSync(join(state, name), "synthetic certificate marker\n");
  for (const name of ["realm.template.json", "keycloak.yaml", "mailpit.yaml"])
    writeFileSync(join(here, name), "{}\n");
  mkdirSync(join(here, "keycloak-theme"));
  writeFileSync(join(here, "keycloak-theme/roles.js.tpl"), "// fixture\n");
  writeFileSync(
    join(state, "secrets.env"),
    `${requiredKeys
      .flatMap((key) =>
        key === missing && !empty
          ? []
          : [`${key}='${key === missing ? "" : marker}'`],
      )
      .join("\n")}\n`,
    { mode: 0o600 },
  );
  const stub = (name: string, body: string) =>
    writeFileSync(
      join(bin, name),
      `#!/bin/bash\nset -euo pipefail\n${body}\n`,
      { mode: 0o700 },
    );
  stub("openssl", 'printf "fixture-certificate"');
  stub("envsubst", "cat");
  stub(
    "kubectl",
    String.raw`printf 'mutation\n' >> "$TEST_EVENTS"
case "$*" in *'apply -f -'*) cat >/dev/null ;; esac`,
  );
  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      STATE_DIR: state,
      NS: "wr-tester",
      KUBECONFIG: "/dev/null",
      TEST_EVENTS: events,
    };
    // A missing synthetic key must not be supplied by the parent machine.
    for (const key of requiredKeys) delete env[key];
    const result = spawnSync("/bin/bash", [join(here, "setup.sh")], {
      encoding: "utf8",
      timeout: 2000,
      env,
    });
    return {
      result,
      mutated: existsSync(events) ? readFileSync(events, "utf8") : "",
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const owner of ["tester-kit", "local-prod"] as const) {
  test.each(requiredKeys)(
    `${owner} rejects empty consumed key %s before Kubernetes mutation`,
    (key) => {
      const { result, mutated } = setupFixture(owner, key, true);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(key, "u"));
      assert.equal(mutated, "");
      assert.ok(!`${result.stdout}${result.stderr}`.includes(marker));
    },
  );
  test(`${owner} rejects unset consumed key before mutation`, () => {
    const { result, mutated } = setupFixture(owner, "AUTH_JWT_SECRET", false);
    assert.notEqual(result.status, 0);
    assert.equal(mutated, "");
    assert.match(result.stderr, /AUTH_JWT_SECRET/u);
  });
  test(`${owner} preserves the valid existing-secret setup flow`, () => {
    const { result, mutated } = setupFixture(owner, null, false);
    assert.equal(result.status, 0, result.stderr);
    assert.notEqual(mutated, "");
  });
}
