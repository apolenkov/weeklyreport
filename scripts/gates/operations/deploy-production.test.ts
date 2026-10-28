import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, test } from "vitest";
import { parse } from "yaml";

interface DeployJob {
  readonly script: readonly string[];
  readonly image: { readonly name: string };
  readonly needs?: readonly { readonly job: string }[];
  readonly resource_group: string;
  readonly environment: { readonly name: string };
}

const jobs = parse(readFileSync(resolve(".gitlab-ci.yml"), "utf8"), {
  maxAliasCount: 50,
}) as Record<string, DeployJob | undefined>;

function requireDeployJob(): DeployJob {
  const job = jobs["deploy-production"];
  if (job === undefined) {
    throw new Error(".gitlab-ci.yml has no deploy-production job");
  }
  return job;
}

const deployJob = requireDeployJob();

const workspaces = new Set<string>();
afterEach(() => {
  for (const root of workspaces) {
    rmSync(root, { recursive: true, force: true });
  }
  workspaces.clear();
});

const VALUES_SECRET = "values-secret-fixture";
const CONTEXT = "approved-context";
const NAMESPACE = "wr-production";
const SHA = "0123456789abcdef";
const SHARED = `--kube-context ${CONTEXT} --namespace ${NAMESPACE}`;
const CHART_ARGS = `deploy/helm/weeklyreport ${SHARED} -f VALUES --set images.tag=${SHA} --wait=watcher --timeout 10m`;

// Records every call. `history` answers from STUB_HISTORY (absent by default:
// Helm's release-not-found error; present, unreadable, denied, similar), `list`
// from STUB_KNOWN (all states) or STUB_DEPLOYED (--deployed); any subcommand a
// deploy must never run exits 99.
const HELM_STUB = String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$STUB_CALLS"
case "$1" in
  history)
    case "$STUB_HISTORY" in
      present) printf '%s\n' '[{"revision":1,"status":"deployed"}]' ;;
      unreadable) printf '%s\n' '[]' ;;
      denied)
        echo 'Error: query: failed to query with labels: secrets is forbidden' >&2
        exit 1
        ;;
      similar)
        echo 'Error: release: not found in a different place' >&2
        exit 1
        ;;
      *)
        echo 'Error: release: not found' >&2
        exit 1
        ;;
    esac
    ;;
  list)
    if [ -n "$STUB_LIST_FAIL" ]; then
      echo "Error: Kubernetes cluster unreachable" >&2
      exit 1
    fi
    case " $* " in
      *" --deployed "*) printf '%s\n' "$STUB_DEPLOYED" ;;
      *) printf '%s\n' "$STUB_KNOWN" ;;
    esac
    ;;
  install)
    if [ -n "$STUB_INSTALL_FAIL" ]; then
      echo "Error: INSTALLATION FAILED: context deadline exceeded" >&2
      exit 1
    fi
    ;;
  upgrade)
    if [ -n "$STUB_UPGRADE_FAIL" ]; then
      echo "Error: UPGRADE FAILED: context deadline exceeded" >&2
      exit 1
    fi
    ;;
  *)
    echo "unexpected helm subcommand: $1" >&2
    exit 99
    ;;
esac
`;

const CURL_STUB = `#!/bin/sh
if [ -n "$STUB_CURL_FAIL_IMAGE" ]; then
  case "$*" in
    *"$STUB_CURL_FAIL_IMAGE"*)
      printf '404'
      exit 0
      ;;
  esac
fi
printf '200'
exit 0
`;

function runDeploy(env: Readonly<Record<string, string | undefined>> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "deploy-production-"));
  workspaces.add(directory);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const stub = join(bin, "helm");
  writeFileSync(stub, HELM_STUB);
  chmodSync(stub, 0o755);
  const curlStub = join(bin, "curl");
  writeFileSync(curlStub, CURL_STUB);
  chmodSync(curlStub, 0o755);
  const calls = join(directory, "calls.log");
  writeFileSync(calls, "");
  const values = join(directory, "values.yaml");
  writeFileSync(values, `adminPassword: ${VALUES_SECRET}\n`);
  const result = spawnSync(
    "/bin/sh",
    ["-e", "-c", deployJob.script.join("\n")],
    {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        STUB_CALLS: calls,
        HELM_VALUES_FILE: values,
        HELM_NAMESPACE: NAMESPACE,
        HELM_KUBE_CONTEXT: CONTEXT,
        CI_COMMIT_SHA: SHA,
        ...env,
      },
      encoding: "utf8",
    },
  );
  const recorded = readFileSync(calls, "utf8").split("\n").filter(Boolean);
  return {
    result,
    calls: recorded,
    // Discovery is read-only; anything else would change the release.
    mutations: recorded.filter(
      (call) => !call.startsWith("list ") && !call.startsWith("history "),
    ),
    values,
  };
}

test("an absent release is installed and waited on without any rollback", () => {
  const { result, calls, values } = runDeploy();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls, [
    `history weeklyreport ${SHARED} -o json`,
    `list ${SHARED} --filter ^weeklyreport$ -q`,
    `list ${SHARED} --filter ^weeklyreport$ --deployed -q`,
    `install weeklyreport ${CHART_ARGS.replace("VALUES", values)}`,
  ]);
  const install = calls.at(-1) ?? "";
  for (const forbidden of [
    "--atomic",
    "--rollback-on-failure",
    "--create-namespace",
    "--install",
  ]) {
    assert.ok(!install.includes(forbidden), forbidden);
  }
});

test("a deployed release is upgraded, never installed, and keeps waiting", () => {
  const { result, mutations, values } = runDeploy({
    STUB_HISTORY: "present",
    STUB_KNOWN: "weeklyreport",
    STUB_DEPLOYED: "weeklyreport",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(mutations, [
    `upgrade weeklyreport ${CHART_ARGS.replace("VALUES", values)}`,
  ]);
  assert.ok(!(mutations[0] ?? "").includes("--install"));
});

test("a discovery error is never read as an absent release", () => {
  const { result, calls, mutations } = runDeploy({ STUB_LIST_FAIL: "1" });
  assert.notEqual(result.status, 0);
  assert.deepEqual(
    calls.map((call) => call.split(" ")[0]),
    ["history", "list"],
  );
  assert.deepEqual(mutations, []);
});

test("a release in any state but deployed is left untouched", () => {
  const { result, mutations } = runDeploy({
    STUB_HISTORY: "present",
    STUB_KNOWN: "weeklyreport",
    STUB_DEPLOYED: "",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to mutate/);
  assert.deepEqual(mutations, []);
});

for (const stub of [
  { STUB_HISTORY: "present" },
  { STUB_HISTORY: "present", STUB_KNOWN: "weeklyreport" },
  { STUB_DEPLOYED: "weeklyreport" },
  {
    STUB_KNOWN: "weeklyreport\nweeklyreport-old",
    STUB_DEPLOYED: "weeklyreport",
  },
  { STUB_KNOWN: "other", STUB_DEPLOYED: "other" },
]) {
  test(`inconsistent or unexpected discovery answers fail closed: ${JSON.stringify(stub)}`, () => {
    const { result, mutations } = runDeploy(stub);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /refusing to mutate/);
    assert.deepEqual(mutations, []);
  });
}

test("an empty list over unreadable release records is not an absent release", () => {
  const { result, mutations } = runDeploy({ STUB_HISTORY: "unreadable" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /history=unknown/);
  assert.deepEqual(mutations, []);
});

for (const variant of ["denied", "similar"] as const) {
  test(`only Helm's exact release-not-found error confirms absence: ${variant}`, () => {
    const { result, mutations } = runDeploy({ STUB_HISTORY: variant });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /refusing to mutate/);
    assert.deepEqual(mutations, []);
  });
}

test("a history failure explains itself without exposing the values file", () => {
  const { result } = runDeploy({ STUB_HISTORY: "denied" });
  assert.match(result.stderr, /forbidden/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(VALUES_SECRET));
});

test("a failed first install leaves the release for diagnosis", () => {
  const { result, calls } = runDeploy({ STUB_INSTALL_FAIL: "1" });
  assert.notEqual(result.status, 0);
  // Only discovery and the install itself: no uninstall, rollback or retry.
  assert.deepEqual(
    calls.map((call) => call.split(" ")[0]),
    ["history", "list", "list", "install"],
  );
});

test("a failed upgrade is not rolled back automatically", () => {
  const { result, calls } = runDeploy({
    STUB_HISTORY: "present",
    STUB_KNOWN: "weeklyreport",
    STUB_DEPLOYED: "weeklyreport",
    STUB_UPGRADE_FAIL: "1",
  });
  assert.notEqual(result.status, 0);
  assert.deepEqual(
    calls.map((call) => call.split(" ")[0]),
    ["history", "list", "list", "upgrade"],
  );
});

test("a missing target or values variable stops before any Helm call", () => {
  for (const name of [
    "HELM_KUBE_CONTEXT",
    "HELM_NAMESPACE",
    "HELM_VALUES_FILE",
  ]) {
    for (const value of [undefined, ""]) {
      const { result, calls } = runDeploy({ [name]: value });
      assert.notEqual(result.status, 0, `${name}=${String(value)}`);
      assert.match(result.stderr, new RegExp(name));
      assert.deepEqual(calls, [], `${name}=${String(value)}`);
    }
  }
});

test("missing image in registry fails deploy before any Helm call", () => {
  const { result, calls } = runDeploy({
    STUB_CURL_FAIL_IMAGE: "web",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Image .*web.* is missing from registry/);
  assert.deepEqual(calls, []);
});

test("every cluster call names the approved context and namespace", () => {
  const { calls } = runDeploy();
  assert.ok(calls.length > 0);
  for (const call of calls) {
    assert.ok(call.includes(SHARED), call);
  }
});

test("the job neither traces commands nor prints the values file", () => {
  const { result } = runDeploy();
  assert.doesNotMatch(deployJob.script.join("\n"), /set -\w*x|xtrace/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(VALUES_SECRET));
});

test("the deploy stays serialized, pinned and has no build-images dependency", () => {
  assert.equal(deployJob.needs, undefined);
  assert.equal(deployJob.resource_group, "weeklyreport-production-deploy");
  assert.equal(deployJob.environment.name, "production");
  assert.match(
    deployJob.image.name,
    /^alpine\/helm:4\.3\.0@sha256:[0-9a-f]{64}$/,
  );
});
