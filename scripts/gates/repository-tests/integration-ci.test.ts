import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const apiCoverageConfig = readFileSync(
  "apps/api/vitest.coverage.config.ts",
  "utf8",
);
const webCoverageConfig = readFileSync("apps/web/vitest.config.ts", "utf8");
const emailIntegration = readFileSync(
  "apps/api/src/infrastructure/email/email-dispatch.integration.test.ts",
  "utf8",
);
const apiPackage = JSON.parse(
  readFileSync("apps/api/package.json", "utf8"),
) as { scripts: Record<string, string> };
const webPackage = JSON.parse(
  readFileSync("apps/web/package.json", "utf8"),
) as { scripts: Record<string, string> };
const rootPackage = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

const escapeRegex = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const jobsSection = (workflowText: string): string => {
  const marker = "jobs:\n";
  const markerOffset = workflowText.indexOf(marker);
  assert.notEqual(markerOffset, -1, "CI workflow must declare jobs");
  return workflowText.slice(markerOffset + marker.length);
};

const jobBlock = (workflowText: string, jobName: string): string => {
  const jobs = jobsSection(workflowText);
  const marker = new RegExp(
    String.raw`^\x20{2}${escapeRegex(jobName)}:\n`,
    "m",
  );
  const match = marker.exec(jobs);
  assert.ok(match, `CI workflow must declare job ${jobName}`);
  const start = match.index + match[0].length;
  const rest = jobs.slice(start);
  const nextJob = rest.search(/^\x20{2}[A-Za-z0-9_-]+:/m);
  return rest.slice(0, nextJob === -1 ? rest.length : nextJob);
};

const stepBlock = (job: string, stepName: string): string => {
  const marker = new RegExp(
    String.raw`^\x20{6}- name: ${escapeRegex(stepName)}\n`,
    "m",
  );
  const match = marker.exec(job);
  assert.ok(match, `CI job must declare step ${stepName}`);
  const start = match.index + match[0].length;
  const rest = job.slice(start);
  const nextStep = rest.search(/^\x20{6}- name:/m);
  return rest.slice(0, nextStep === -1 ? rest.length : nextStep);
};

const replaceInJob = (
  workflowText: string,
  jobName: string,
  needle: string,
  replacement: string,
): string => {
  const job = jobBlock(workflowText, jobName);
  assert.ok(job.includes(needle), `${jobName} must contain mutation target`);
  const replaced = job.replace(needle, replacement);
  const jobs = jobsSection(workflowText);
  const jobOffset = jobs.indexOf(job);
  assert.notEqual(jobOffset, -1, `${jobName} block must be replaceable`);
  const workflowOffset = workflowText.indexOf("jobs:\n") + "jobs:\n".length;
  return (
    workflowText.slice(0, workflowOffset + jobOffset) +
    replaced +
    workflowText.slice(workflowOffset + jobOffset + job.length)
  );
};

const assertApiIntegrationLane = (workflowText: string): void => {
  const job = jobBlock(workflowText, "api-integration");
  assert.match(job, /services:\n[\s\S]*^\x20{6}postgres:/m);
  assert.match(job, /services:\n[\s\S]*^\x20{6}redis:/m);
  assert.match(job, /services:\n[\s\S]*^\x20{6}mailpit:/m);
  assert.match(
    job,
    /E2E_DATABASE_URL: postgresql:\/\/customreport:localdev@localhost:5432\/customreport_e2e/,
  );
  assert.match(
    job,
    /DATABASE_URL: postgresql:\/\/customreport:localdev@localhost:5432\/customreport_generate_only/,
  );
  assert.match(job, /REDIS_DB: ["']?15["']?/);
  assert.match(job, /REQUIRED_INTEGRATION_DEPS: ["']?true["']?/);
  assert.match(job, /SMTP_HOST: localhost/);
  assert.match(job, /SMTP_PORT: ["']?1025["']?/);
  assert.match(job, /pnpm --filter @customreport\/api test:integration/);
};

const assertCoverageLane = (workflowText: string): void => {
  const job = jobBlock(workflowText, "coverage");
  assert.match(job, /services:\n[\s\S]*^\x20{6}postgres:/m);
  assert.match(job, /services:\n[\s\S]*^\x20{6}redis:/m);
  assert.match(job, /services:\n[\s\S]*^\x20{6}mailpit:/m);
  assert.match(
    job,
    /pnpm exec prisma migrate deploy --schema=prisma\/schema\.prisma/,
  );
  assert.match(job, /pnpm test:coverage/);
};

const assertMigrateResetSeed = (workflowText: string): void => {
  const job = jobBlock(workflowText, "migrate-reset");
  const reset = stepBlock(
    job,
    "prisma migrate reset (exact disposable E2E DB)",
  );
  const seed = stepBlock(job, "Seed canonical full profile after reset");
  assert.match(reset, /PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай"/);
  assert.match(reset, /pnpm exec tsx prisma\/operations\/migrate-reset\.ts/);
  assert.match(seed, /PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай"/);
  assert.match(
    seed,
    /pnpm --dir apps\/api exec tsx \.\.\/\.\.\/prisma\/seeds\/profiles\/seed-profile\.ts full/,
  );
};

type CoverageMetric = "statements" | "branches" | "functions" | "lines";
type CoverageThresholds = Record<CoverageMetric, number>;

const readThresholds = (source: string, label: string): CoverageThresholds => {
  const thresholdsOffset = source.indexOf("thresholds:");
  assert.notEqual(
    thresholdsOffset,
    -1,
    `${label} must declare coverage thresholds`,
  );
  const openingOffset = source.indexOf("{", thresholdsOffset);
  assert.notEqual(openingOffset, -1, `${label} must open coverage thresholds`);
  const closingOffset = source.indexOf("}", openingOffset);
  assert.notEqual(closingOffset, -1, `${label} must close coverage thresholds`);
  const thresholdsBody = source.slice(openingOffset + 1, closingOffset);
  const values = {} as CoverageThresholds;
  for (const metric of [
    "statements",
    "branches",
    "functions",
    "lines",
  ] as const) {
    const metricOffset = thresholdsBody.indexOf(`${metric}:`);
    assert.notEqual(
      metricOffset,
      -1,
      `${label} must declare ${metric} threshold`,
    );
    const remainder = thresholdsBody
      .slice(metricOffset + metric.length + 1)
      .trimStart();
    const valueEnd = remainder.search(/[\s,]/u);
    const valueText =
      valueEnd === -1 ? remainder : remainder.slice(0, valueEnd);
    assert.match(
      valueText,
      /^\d+$/u,
      `${label} must declare numeric ${metric} threshold`,
    );
    values[metric] = Number(valueText);
  }
  return values;
};

const assertCoverageConfig = (
  source: string,
  label: string,
  expected: CoverageThresholds,
  exclusions: readonly string[],
): void => {
  assert.deepEqual(readThresholds(source, label), expected);
  for (const exclusion of exclusions) {
    assert.match(
      source,
      new RegExp(`"${escapeRegex(exclusion)}"`),
      `${label} must retain exclusion ${exclusion}`,
    );
  }
};

const API_EXCLUSIONS = [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "src/**/*.integration.test.ts",
  "src/**/*.eval.test.ts",
  "src/**/__tests__/**",
  "src/**/test-utils/**",
  "src/main.ts",
  "src/**/*.module.ts",
] as const;

const WEB_EXCLUSIONS = [
  "src/**/*.test.{ts,tsx}",
  "src/**/__tests__/**",
  "src/**/types.ts",
  "src/app/**/layout.tsx",
  "src/app/(app)/admin/products/page.tsx",
  "src/app/(app)/admin/activities/page.tsx",
  "src/app/(app)/admin/settings/page.tsx",
  "src/app/(app)/head/history/page.tsx",
  "src/app/(app)/head/slides/page.tsx",
  "src/app/(app)/lead/history/page.tsx",
  "src/app/(app)/reports/history/page.tsx",
] as const;

void test("CI keeps a serial, disposable API integration lane with live dependencies", () => {
  assertApiIntegrationLane(workflow);
  assert.match(apiPackage.scripts.test?.toString() ?? "", /vitest run/);
  assert.match(
    apiPackage.scripts["test:integration"] ?? "",
    /--fileParallelism=false/,
  );
  assert.match(
    apiPackage.scripts["test:integration"] ?? "",
    /NODE_OPTIONS=--throw-deprecation/,
  );
  assert.match(emailIntegration, /REQUIRED_INTEGRATION_DEPS/);
  assert.match(emailIntegration, /Required integration dependency unavailable/);
});

void test("API integration assertions fail when their own job loses a required value", () => {
  const mutated = replaceInJob(
    workflow,
    "api-integration",
    '      REDIS_DB: "15"\n',
    "",
  );
  assert.match(jobBlock(mutated, "coverage"), /REDIS_DB: "15"/);
  assert.throws(() => assertApiIntegrationLane(mutated), /REDIS_DB/);
});

void test("CI exposes explicit API and Web coverage jobs without changing suite floors", () => {
  assertCoverageLane(workflow);
  assert.match(
    rootPackage.scripts["test:coverage"] ?? "",
    /@customreport\/api/,
  );
  assert.match(
    rootPackage.scripts["test:coverage"] ?? "",
    /@customreport\/web/,
  );
  assert.match(apiPackage.scripts["test:coverage"] ?? "", /--coverage/);
  assert.match(
    apiPackage.scripts["test:coverage"] ?? "",
    /vitest\.coverage\.config\.ts/,
  );
  assert.match(
    apiPackage.scripts["test:coverage"] ?? "",
    /--fileParallelism=false/,
  );
  assert.match(
    apiPackage.scripts["test:coverage"] ?? "",
    /NODE_OPTIONS=--throw-deprecation/,
  );
  assert.match(webPackage.scripts["test:coverage"] ?? "", /--coverage/);
  assert.match(
    apiPackage.scripts["test:coverage"] ?? "",
    /coverage-evidence\.ts/,
  );
  assert.match(
    webPackage.scripts["test:coverage"] ?? "",
    /coverage-evidence\.ts/,
  );
});

void test("coverage assertions fail when the coverage job loses its migration", () => {
  const mutated = replaceInJob(
    workflow,
    "coverage",
    "      - name: Apply migrations for serial API coverage\n        env:\n          DATABASE_URL: postgresql://customreport:localdev@localhost:5432/customreport_e2e\n        run: pnpm exec prisma migrate deploy --schema=prisma/schema.prisma\n\n",
    "",
  );
  assert.match(
    jobBlock(mutated, "api-integration"),
    /pnpm exec prisma migrate deploy --schema=prisma\/schema\.prisma/,
  );
  assert.throws(() => assertCoverageLane(mutated), /migrate deploy/);
});

void test("the fast root test command remains the unit contour", () => {
  assert.equal(
    rootPackage.scripts.test,
    "turbo run test && vitest run --config vitest.prisma.config.ts",
  );
  assert.doesNotMatch(rootPackage.scripts.test, /coverage|integration/);
});

void test("migrate-reset seeds the canonical full profile with per-step consent", () => {
  assertMigrateResetSeed(workflow);
});

void test("migrate-reset seed assertions fail when consent is removed from that step", () => {
  const mutated = replaceInJob(
    workflow,
    "migrate-reset",
    '      - name: Seed canonical full profile after reset\n        env:\n          PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай"',
    '      - name: Seed canonical full profile after reset\n        env:\n          PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: ""',
  );
  assert.match(
    stepBlock(
      jobBlock(mutated, "migrate-reset"),
      "prisma migrate reset (exact disposable E2E DB)",
    ),
    /PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай"/,
  );
  assert.throws(() => assertMigrateResetSeed(mutated), /давай/);
});

void test("API coverage config pins thresholds and critical exclusions", () => {
  assertCoverageConfig(
    apiCoverageConfig,
    "API coverage config",
    { statements: 80, branches: 70, functions: 80, lines: 80 },
    API_EXCLUSIONS,
  );
});

void test("Web coverage config pins thresholds and critical exclusions", () => {
  assertCoverageConfig(
    webCoverageConfig,
    "Web coverage config",
    { statements: 70, branches: 60, functions: 70, lines: 70 },
    WEB_EXCLUSIONS,
  );
});

void test("coverage threshold assertions fail on a lowered API floor", () => {
  const mutated = apiCoverageConfig.replace("statements: 80", "statements: 79");
  assert.throws(
    () =>
      assertCoverageConfig(
        mutated,
        "API coverage config",
        { statements: 80, branches: 70, functions: 80, lines: 80 },
        API_EXCLUSIONS,
      ),
    /statements/,
  );
});

void test("coverage threshold assertions fail on a lowered Web floor", () => {
  const mutated = webCoverageConfig.replace("statements: 70", "statements: 69");
  assert.throws(
    () =>
      assertCoverageConfig(
        mutated,
        "Web coverage config",
        { statements: 70, branches: 60, functions: 70, lines: 70 },
        WEB_EXCLUSIONS,
      ),
    /statements/,
  );
});

void test("coverage exclusion assertions fail when a critical API exclusion is removed", () => {
  const mutated = apiCoverageConfig.replace(
    '          "src/**/*.integration.test.ts",\n',
    "",
  );
  assert.throws(
    () =>
      assertCoverageConfig(
        mutated,
        "API coverage config",
        { statements: 80, branches: 70, functions: 80, lines: 80 },
        API_EXCLUSIONS,
      ),
    /integration\.test\.ts/,
  );
});

void test("coverage exclusion assertions fail when a critical Web exclusion is removed", () => {
  const mutated = webCoverageConfig.replace(
    '        "src/app/(app)/admin/products/page.tsx",\n',
    "",
  );
  assert.throws(
    () =>
      assertCoverageConfig(
        mutated,
        "Web coverage config",
        { statements: 70, branches: 60, functions: 70, lines: 70 },
        WEB_EXCLUSIONS,
      ),
    /admin\/products\/page\.tsx/,
  );
});
