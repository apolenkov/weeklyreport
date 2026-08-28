import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  parseWorkflow,
  workflowFiles,
  workflowHygieneFindings,
  type WorkflowPlainObject,
} from "./workflow-policy.ts";

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

void test("repository ESLint has a bounded heap above the measured live scan", () => {
  const packageJson: unknown = JSON.parse(readFileSync("package.json", "utf8"));
  const scripts = isRecord(packageJson) ? packageJson.scripts : undefined;
  assert.equal(
    isRecord(scripts) ? scripts["lint:eslint"] : undefined,
    "NODE_OPTIONS=--max-old-space-size=6144 eslint . --max-warnings 0",
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

const qualityWorkflow = (
  steps: readonly Readonly<{ name: string; run: string }>[],
): string =>
  [
    "name: Fixture",
    "on: push",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  quality:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    ...steps.flatMap(({ name, run }) => [
      `      - name: ${JSON.stringify(name)}`,
      `        run: ${JSON.stringify(run)}`,
    ]),
  ].join("\n");

const objectAt = (
  value: unknown,
  key: string,
): WorkflowPlainObject | undefined =>
  isRecord(value) && isRecord(value[key]) ? value[key] : undefined;

const stringAt = (value: unknown, key: string): string | undefined =>
  isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;

const stepsAt = (job: WorkflowPlainObject): readonly WorkflowPlainObject[] => {
  const steps = job.steps;
  return Array.isArray(steps)
    ? steps.filter((step): step is WorkflowPlainObject => isRecord(step))
    : [];
};

const stepIndex = (
  steps: readonly WorkflowPlainObject[],
  predicate: (step: WorkflowPlainObject) => boolean,
): number => steps.findIndex(predicate);

const DANGEROUS_CONSENT_KEY = "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION";
const EXACT_CONSENT = "давай";

const requireStep = (
  findings: string[],
  steps: readonly WorkflowPlainObject[],
  name: string,
  run: string,
): number => {
  const index = stepIndex(steps, (step) => stringAt(step, "name") === name);
  if (index < 0) {
    findings.push(`CI must define the ${name} step`);
    return index;
  }
  const step = steps[index];
  if (stringAt(step, "run") !== run)
    findings.push(`${name} must use its exact guarded command`);
  const environment = objectAt(step, "env");
  if (stringAt(environment, DANGEROUS_CONSENT_KEY) !== EXACT_CONSENT)
    findings.push(`${name} requires exact step-local consent`);
  return index;
};

const destructiveDatabaseWorkflowFindings = (
  source: string,
): readonly string[] => {
  const parsed = parseWorkflow(source);
  if (!parsed.ok) return parsed.findings;
  const jobs = objectAt(parsed.workflow, "jobs");
  if (jobs === undefined) return ["CI workflow jobs must be a mapping"];

  const e2e = objectAt(jobs, "e2e");
  const migrateReset = objectAt(jobs, "migrate-reset");
  const findings: string[] = [];
  if (e2e === undefined) findings.push("CI must define the e2e job");
  if (migrateReset === undefined)
    findings.push("CI must define the migrate-reset job");
  if (e2e === undefined || migrateReset === undefined) return findings;

  const e2eServices = objectAt(e2e, "services");
  const e2ePostgres = objectAt(e2eServices, "postgres");
  const e2ePostgresEnv = objectAt(e2ePostgres, "env");
  if (
    stringAt(e2ePostgresEnv, "POSTGRES_DB") !== "customreport_e2e_lane_a_test"
  )
    findings.push("e2e postgres service must use customreport_e2e_lane_a_test");

  const e2eEnv = objectAt(e2e, "env");
  if (
    stringAt(e2eEnv, "DATABASE_URL") !==
    "postgresql://customreport:localdev@localhost:5432/customreport_e2e_lane_a_test"
  )
    findings.push("e2e job DATABASE_URL must use customreport_e2e_lane_a_test");
  if (stringAt(e2eEnv, DANGEROUS_CONSENT_KEY) !== undefined)
    findings.push("e2e job must not grant blanket destructive consent");

  const e2eSteps = stepsAt(e2e);
  const createIndex = requireStep(
    findings,
    e2eSteps,
    "Create E2E database",
    "pnpm exec tsx prisma/operations/create-e2e-database.ts",
  );
  if (createIndex >= 0) {
    const createEnv = objectAt(e2eSteps[createIndex], "env");
    if (
      stringAt(createEnv, "E2E_DATABASE_URL") !==
      "postgresql://customreport:localdev@localhost:5432/customreport_e2e"
    )
      findings.push("Create E2E database must target customreport_e2e");
  }
  const migrationIndex = requireStep(
    findings,
    e2eSteps,
    "Run database migrations",
    "pnpm exec tsx prisma/operations/migrate-deploy.ts",
  );
  const seedIndex = requireStep(
    findings,
    e2eSteps,
    "Seed database",
    "pnpm exec tsx prisma/seed.ts",
  );
  const integrationIndex = requireStep(
    findings,
    e2eSteps,
    "Integration Tests",
    "pnpm --filter=@customreport/api test:integration",
  );
  for (const [index, name, urlKey] of [
    [migrationIndex, "Run database migrations", "DATABASE_URL"],
    [seedIndex, "Seed database", "DATABASE_URL"],
    [integrationIndex, "Integration Tests", "E2E_DATABASE_URL"],
  ] as const) {
    if (index < 0) continue;
    const stepEnvironment = objectAt(e2eSteps[index], "env");
    if (
      stringAt(stepEnvironment, urlKey) !==
      "postgresql://customreport:localdev@localhost:5432/customreport_e2e"
    )
      findings.push(`${name} must target the distinct customreport_e2e DB`);
  }
  if (
    createIndex >= 0 &&
    [migrationIndex, seedIndex, integrationIndex].some(
      (index) => index < 0 || createIndex >= index,
    )
  )
    findings.push("Create E2E database must precede migrations and API tests");
  const e2eTestIndex = requireStep(
    findings,
    e2eSteps,
    "Run E2E tests",
    "pnpm test:e2e:integration",
  );
  if (e2eTestIndex >= 0 && (createIndex < 0 || createIndex >= e2eTestIndex)) {
    findings.push("Create E2E database must precede Run E2E tests");
  } else if (e2eTestIndex >= 0) {
    const testEnv = objectAt(e2eSteps[e2eTestIndex], "env");
    if (
      stringAt(testEnv, "E2E_DATABASE_URL") !==
      "postgresql://customreport:localdev@localhost:5432/customreport_e2e"
    )
      findings.push("Run E2E tests must target customreport_e2e");
  }

  const migrateServices = objectAt(migrateReset, "services");
  const migratePostgres = objectAt(migrateServices, "postgres");
  const migratePostgresEnv = objectAt(migratePostgres, "env");
  if (stringAt(migratePostgresEnv, "POSTGRES_DB") !== "customreport_e2e")
    findings.push("migrate-reset postgres service must use customreport_e2e");
  const migrateEnv = objectAt(migrateReset, "env");
  if (
    stringAt(migrateEnv, "DATABASE_URL") !==
    "postgresql://customreport:localdev@localhost:5432/customreport_e2e"
  )
    findings.push("migrate-reset job DATABASE_URL must use customreport_e2e");
  if (stringAt(migrateEnv, DANGEROUS_CONSENT_KEY) !== undefined)
    findings.push(
      "migrate-reset job must not grant blanket destructive consent",
    );
  const migrateSteps = stepsAt(migrateReset);
  const resetIndex = requireStep(
    findings,
    migrateSteps,
    "prisma migrate reset (exact disposable E2E DB, no seed)",
    "pnpm exec tsx prisma/operations/migrate-reset.ts",
  );
  const generateIndex = stepIndex(
    migrateSteps,
    (step) => stringAt(step, "name") === "prisma generate (post-reset)",
  );
  if (generateIndex >= 0 && (resetIndex < 0 || resetIndex >= generateIndex))
    findings.push("guarded migrate-reset must precede post-reset generation");

  return findings;
};

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

void test("quality job installs isolated Chromium before its unit tests", () => {
  const source = qualityWorkflow([
    {
      name: "Install Playwright browsers",
      run: "pnpm --filter @customreport/web exec playwright install --with-deps chromium",
    },
    { name: "Unit Tests", run: "pnpm test" },
  ]);
  assert.deepEqual(workflowHygieneFindings(source), []);
});

void test("quality job rejects a missing, late, or bypassed Chromium install", () => {
  const cases = [
    [{ name: "Unit Tests", run: "pnpm test" }],
    [
      { name: "Unit Tests", run: "pnpm test" },
      {
        name: "Install Playwright browsers",
        run: "pnpm --filter @customreport/web exec playwright install --with-deps chromium",
      },
    ],
    [
      {
        name: "Install Playwright browsers",
        run: "pnpm exec playwright install --with-deps chromium",
      },
      { name: "Unit Tests", run: "pnpm test" },
    ],
  ] as const;

  cases.forEach((steps) => {
    expectFinding(
      qualityWorkflow(steps),
      /quality job must install isolated Playwright Chromium before Unit Tests/u,
    );
  });
});

void test("checked-in workflows satisfy the security policy", () => {
  const findings = workflowFiles().flatMap((file) =>
    workflowHygieneFindings(readFileSync(file, "utf8")).map(
      (finding) => `${path.relative(process.cwd(), file)}:${finding}`,
    ),
  );
  assert.deepEqual(findings, []);
});

void test("CI destructive database commands stay on guarded exact targets", () => {
  const source = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
  assert.deepEqual(destructiveDatabaseWorkflowFindings(source), []);
  assert.match(source, /POSTGRES_DB: customreport_e2e_lane_a_test/u);
  assert.match(
    source,
    /DATABASE_URL: postgresql:\/\/customreport:localdev@localhost:5432\/customreport_e2e_lane_a_test/u,
  );
  assert.match(
    source,
    /E2E_DATABASE_URL: postgresql:\/\/customreport:localdev@localhost:5432\/customreport_e2e/u,
  );
  assert.match(source, /prisma\/operations\/create-e2e-database\.ts/u);
  assert.match(source, /prisma\/operations\/migrate-reset\.ts/u);
});

void test("CI destructive database fixtures reject drift", () => {
  const current = readFileSync(
    path.resolve(".github/workflows/ci.yml"),
    "utf8",
  );
  const integrationStep = [
    "      - name: Integration Tests",
    "        env:",
    "          E2E_DATABASE_URL: postgresql://customreport:localdev@localhost:5432/customreport_e2e",
    '          PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай"',
    "        run: pnpm --filter=@customreport/api test:integration",
  ].join("\n");
  const missingConsent = current.replace(
    integrationStep,
    [
      "      - name: Integration Tests",
      "        run: pnpm --filter=@customreport/api test:integration",
    ].join("\n"),
  );
  assert.ok(
    destructiveDatabaseWorkflowFindings(missingConsent).includes(
      "Integration Tests requires exact step-local consent",
    ),
  );
  const unsafeJobValue = current.replace(
    "          POSTGRES_DB: customreport_e2e_lane_a_test",
    "          POSTGRES_DB: customreport_test # customreport_e2e_lane_a_test",
  );
  assert.ok(
    destructiveDatabaseWorkflowFindings(unsafeJobValue).includes(
      "e2e postgres service must use customreport_e2e_lane_a_test",
    ),
  );
  const blanketConsent = current
    .replace(
      "      DATABASE_URL: postgresql://customreport:localdev@localhost:5432/customreport_e2e_lane_a_test",
      [
        "      DATABASE_URL: postgresql://customreport:localdev@localhost:5432/customreport_e2e_lane_a_test",
        '      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай"',
      ].join("\n"),
    )
    .replace(
      integrationStep,
      [
        "      - name: Integration Tests",
        "        run: pnpm --filter=@customreport/api test:integration",
      ].join("\n"),
    );
  const blanketFindings = destructiveDatabaseWorkflowFindings(blanketConsent);
  assert.ok(
    blanketFindings.includes(
      "e2e job must not grant blanket destructive consent",
    ),
  );
  assert.ok(
    blanketFindings.includes(
      "Integration Tests requires exact step-local consent",
    ),
  );
  const guardedCommandLookalikeOutsideRun = current.replace(
    "        run: pnpm exec tsx prisma/operations/migrate-reset.ts",
    "        # run: pnpm exec tsx prisma/operations/migrate-reset.ts\n        run: pnpm exec prisma migrate reset --force",
  );
  assert.ok(
    destructiveDatabaseWorkflowFindings(
      guardedCommandLookalikeOutsideRun,
    ).includes(
      "prisma migrate reset (exact disposable E2E DB, no seed) must use its exact guarded command",
    ),
  );
  const commentsDoNotAuthorize = missingConsent.replace(
    "    # Playwright owns all Web/API URLs.",
    '    # PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай"\n    # Playwright owns all Web/API URLs.',
  );
  assert.ok(
    destructiveDatabaseWorkflowFindings(commentsDoNotAuthorize).includes(
      "Integration Tests requires exact step-local consent",
    ),
  );
  const wrongIntegrationTarget = current.replace(
    integrationStep,
    integrationStep.replace(
      "customreport_e2e\n          PRISMA",
      "customreport_e2e_lane_a_test\n          PRISMA",
    ),
  );
  assert.ok(
    destructiveDatabaseWorkflowFindings(wrongIntegrationTarget).includes(
      "Integration Tests must target the distinct customreport_e2e DB",
    ),
  );
});
