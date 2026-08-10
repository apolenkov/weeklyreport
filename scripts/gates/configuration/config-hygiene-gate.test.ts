import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { workflowFiles, workflowHygieneFindings } from "./workflow-policy.ts";

const ARCHAEOLOGY =
  /(?:tasks[.]md|HEAD-CONSOLIDATE|Phase\s+\d|fix-report-surface-integrity|\(task\s+\d)/u;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hygieneFindings = (source: string): readonly string[] =>
  source
    .split("\n")
    .flatMap((line, index) =>
      ARCHAEOLOGY.test(line) ? [`${index + 1}: ${line}`] : [],
    );

void test("planted config archaeology is rejected", () => {
  assert.deepEqual(hygieneFindings("note: Phase 2 rollout\nok"), [
    "1: note: Phase 2 rollout",
  ]);
});

void test("active catalog and environment examples contain no archaeology", () => {
  const catalogDirectory = path.resolve("e2e/catalog");
  const files = [
    ...readdirSync(catalogDirectory)
      .filter((file) => /[.](?:md|yaml)$/u.test(file))
      .map((file) => path.join(catalogDirectory, file)),
    path.resolve(".env.example"),
  ];
  const findings = files.flatMap((file) =>
    hygieneFindings(readFileSync(file, "utf8")).map(
      (finding) => `${path.relative(process.cwd(), file)}:${finding}`,
    ),
  );
  assert.deepEqual(findings, []);
});

void test("environment example references current maintained paths and version", () => {
  const source = readFileSync(".env.example", "utf8");
  const packageVersion: unknown = JSON.parse(
    readFileSync("package.json", "utf8"),
  );
  assert.equal(
    typeof packageVersion === "object" &&
      packageVersion !== null &&
      "version" in packageVersion &&
      typeof packageVersion.version === "string",
    true,
  );
  assert.match(source, /e2e\/playwright[.]integration[.]config[.]ts/u);
  assert.match(
    source,
    /apps\/web\/src\/shared\/ui\/auth-runtime\/role-switcher[.]tsx/u,
  );
  assert.doesNotMatch(
    source,
    /apps\/web\/playwright[.]integration[.]config[.]ts/u,
  );
  assert.doesNotMatch(
    source,
    /apps\/web\/src\/components\/dev\/role-switcher[.]tsx/u,
  );
  if (
    typeof packageVersion === "object" &&
    packageVersion !== null &&
    "version" in packageVersion &&
    typeof packageVersion.version === "string"
  ) {
    assert.match(
      source,
      new RegExp(`OTEL_SERVICE_VERSION=${packageVersion.version}`, "u"),
    );
  }
});

void test("Knip does not load the environment-dependent Prisma config", () => {
  const config: unknown = JSON.parse(readFileSync("knip.json", "utf8"));
  const packageJson: unknown = JSON.parse(readFileSync("package.json", "utf8"));
  const workspaces = isRecord(config) ? config.workspaces : undefined;
  const rootWorkspace = isRecord(workspaces) ? workspaces["."] : undefined;
  const prisma = isRecord(rootWorkspace) ? rootWorkspace.prisma : undefined;
  const scripts = isRecord(packageJson) ? packageJson.scripts : undefined;
  assert.deepEqual(isRecord(prisma) ? prisma.config : undefined, []);
  assert.equal(
    isRecord(scripts) ? scripts.knip : undefined,
    "knip --treat-config-hints-as-errors",
  );
});

const readOnlyWorkflow = (permissions: string): string =>
  [
    "name: Fixture",
    "on: push",
    permissions,
    "jobs:",
    "  check:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "        with:",
    "          persist-credentials: false",
  ].join("\n");

const jobPermissionWorkflow = (permissions: string): string =>
  [
    "name: Fixture",
    "on: push",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  build:",
    permissions,
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: echo build",
  ].join("\n");

const findingsText = (source: string): string =>
  workflowHygieneFindings(source).join("\n");

const expectFinding = (source: string, pattern: RegExp): void => {
  assert.match(findingsText(source), pattern);
};

void test("workflow policy accepts explicit read-only permissions", () => {
  assert.deepEqual(
    workflowHygieneFindings(
      readOnlyWorkflow(["permissions:", "  contents: read"].join("\n")),
    ),
    [],
  );
});

void test("workflow policy rejects a missing top-level baseline", () => {
  expectFinding(
    readOnlyWorkflow(""),
    /top-level permissions must declare contents: read/u,
  );
});

void test("workflow policy rejects broad top-level permissions", () => {
  expectFinding(
    readOnlyWorkflow("permissions: write-all"),
    /top-level permissions grant a broad scope/u,
  );
});

void test("workflow policy rejects encoded top-level write scopes", () => {
  [
    ["permissions:", "  contents: read", "  issues: write"].join("\n"),
    'permissions: { contents: read, issues: "write" }',
    "permissions: { contents: read, issues: !!str write }",
  ].forEach((permissions) => {
    expectFinding(
      readOnlyWorkflow(permissions),
      /top-level permissions grant a broad scope/u,
    );
  });
});

void test("workflow policy does not treat an empty map as the baseline", () => {
  expectFinding(
    readOnlyWorkflow("permissions: {}"),
    /top-level permissions must declare contents: read/u,
  );
});

void test("workflow parser rejects ambiguous YAML documents", () => {
  [
    "permissions: [unterminated",
    ["permissions: {}", "permissions: {}"].join("\n"),
    [
      "permissions: &readOnly",
      "  contents: read",
      "jobs:",
      "  check:",
      "    permissions: *readOnly",
    ].join("\n"),
  ].forEach((source) => {
    expectFinding(source, /workflow YAML (?:is invalid|cannot be resolved)/u);
  });
});

void test("workflow policy rejects retained checkout credentials", () => {
  const source = readOnlyWorkflow(
    ["permissions:", "  contents: read"].join("\n"),
  ).replace("persist-credentials: false", "persist-credentials: true");
  assert.match(
    findingsText(source),
    /checkout must set persist-credentials: false/u,
  );
});

void test("workflow policy rejects checkout without a persistence setting", () => {
  const source = readOnlyWorkflow(
    ["permissions:", "  contents: read"].join("\n"),
  ).replace(
    ["        with:", "          persist-credentials: false"].join("\n"),
    "",
  );
  assert.match(
    findingsText(source),
    /checkout must set persist-credentials: false/u,
  );
});

void test("workflow policy ignores a persistence lookalike outside with", () => {
  const source = readOnlyWorkflow(
    ["permissions:", "  contents: read"].join("\n"),
  ).replace(
    ["        with:", "          persist-credentials: false"].join("\n"),
    ["        env:", "          persist-credentials: false"].join("\n"),
  );
  assert.match(
    findingsText(source),
    /checkout must set persist-credentials: false/u,
  );
});

void test("workflow policy parses flow-style case-variant checkout", () => {
  const source = readOnlyWorkflow(
    ["permissions:", "  contents: read"].join("\n"),
  )
    .replace(
      "      - uses: actions/checkout@v4",
      "      - { uses: Actions/Checkout@v4 }",
    )
    .replace(
      ["        with:", "          persist-credentials: false"].join("\n"),
      "",
    );
  assert.match(
    findingsText(source),
    /checkout must set persist-credentials: false/u,
  );
});

void test("workflow policy rejects job-level write permissions", () => {
  const source = jobPermissionWorkflow(
    ["    permissions:", "      contents: write"].join("\n"),
  );
  assert.match(
    findingsText(source),
    /job-level permissions must use explicit non-write scopes/u,
  );
});

void test("workflow policy rejects dynamic job-level permissions", () => {
  const source = jobPermissionWorkflow(
    ["    permissions: $", "{{ inputs.permissions }}"].join(""),
  );
  assert.match(
    findingsText(source),
    /job-level permissions must use explicit non-write scopes/u,
  );
});

void test("workflow policy rejects unparsed job-level permission entries", () => {
  const source = jobPermissionWorkflow(
    ["    permissions:", '      "contents": write'].join("\n"),
  );
  assert.match(
    findingsText(source),
    /job-level permissions must use explicit non-write scopes/u,
  );
});

void test("workflow policy rejects bare broad job-level permissions", () => {
  const source = jobPermissionWorkflow("    permissions: write-all");
  assert.match(
    findingsText(source),
    /job-level permissions must use explicit non-write scopes/u,
  );
});

void test("workflow policy allows explicit read-only job permissions", () => {
  const source = jobPermissionWorkflow(
    "    permissions: { contents: read, actions: none }",
  );
  assert.deepEqual(workflowHygieneFindings(source), []);
});

void test("checked-in workflows satisfy the security policy", () => {
  const findings = workflowFiles().flatMap((file) =>
    workflowHygieneFindings(readFileSync(file, "utf8")).map(
      (finding) => `${path.relative(process.cwd(), file)}:${finding}`,
    ),
  );
  assert.deepEqual(findings, []);
});
