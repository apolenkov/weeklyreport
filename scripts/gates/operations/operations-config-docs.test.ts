import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";

import { mergeNextEnvironment } from "../../../apps/web/scripts/run-next.ts";

const read = (path: string): string => readFileSync(resolve(path), "utf8");
const operations = read("docs/operations.md");
const onboarding = read("docs/onboarding.md");
const readme = read("README.md");
const localEnvironment = read(".env.example");
const integrationEnvironment = read(".env.test.example");
const productionValues = read(
  "deploy/helm/weeklyreport/values.production.example.yaml",
);
const dashboardProviders =
  "deploy/helm/weeklyreport/observability/grafana/provisioning/dashboards";
const operationalDashboardProvider = read(
  `${dashboardProviders}/weeklyreport.yml`,
);
const productDashboardProvider = read(
  `${dashboardProviders}/product-telemetry.yml`,
);
const localDependencies = read("deploy/local-dev/deps.yaml");
const localBootstrap = read("prisma/operations/bootstrap-local.ts");
const apiBootstrap = read("apps/api/src/bootstrap/api-bootstrap.ts");
const caddyReadme = read("deploy/helm/weeklyreport/README.md");
const packageJson = JSON.parse(read("package.json")) as {
  readonly scripts: Readonly<Record<string, string | undefined>>;
};
const apiPackageJson = JSON.parse(read("apps/api/package.json")) as {
  readonly scripts: Readonly<Record<string, string | undefined>>;
};
const webPackageJson = JSON.parse(read("apps/web/package.json")) as {
  readonly scripts: Readonly<Record<string, string | undefined>>;
};
const gitlabContent = read(".gitlab-ci.yml");
const gitlabCiDoc = read("docs/gitlab-ci.md");
const vitestBase = read("vitest.base.config.ts");

const assertLocalBootstrapContract = (
  environmentExample: string,
  quickStart: string,
): void => {
  const target =
    "postgresql://weeklyreport:localdev@localhost:5432/weeklyreport_e2e";
  assert.ok(environmentExample.includes(`DATABASE_URL=${target}`));
  assert.ok(environmentExample.includes(`E2E_DATABASE_URL=${target}`));
  assert.equal(
    packageJson.scripts["db:bootstrap:local"],
    "node --import tsx prisma/operations/bootstrap-local.ts",
  );
  assert.ok(
    quickStart.includes(
      "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \\\n  pnpm db:bootstrap:local demo",
    ),
  );
  assert.ok(
    onboarding.includes("Каждый шаг повторно проверяет guard и согласие"),
  );
  for (const script of [
    "create-e2e-database.ts",
    "migrate-deploy.ts",
    "seed-profile.ts",
  ]) {
    assert.ok(localBootstrap.includes(script));
  }
  assert.match(
    localDependencies,
    /name: POSTGRES_DB, value: weeklyreport_e2e/u,
  );
  assert.match(localDependencies, /name: POSTGRES_PASSWORD, value: localdev/u);
  assert.ok(localEnvironment.includes("POSTGRES_DB=weeklyreport_e2e"));
};

test("local quick start bootstraps one exact guarded database", () => {
  assertLocalBootstrapContract(localEnvironment, readme);
});

test("local bootstrap contract rejects target and consent drift", () => {
  const wrongTarget = localEnvironment.replaceAll(
    "/weeklyreport_e2e",
    "/weeklyreport_dev",
  );
  const wrongConsent = readme.replace(
    "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'",
    "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='yes'",
  );
  assert.notEqual(wrongTarget, localEnvironment);
  assert.notEqual(wrongConsent, readme);
  assert.throws(() => assertLocalBootstrapContract(wrongTarget, readme));
  assert.throws(() =>
    assertLocalBootstrapContract(localEnvironment, wrongConsent),
  );
});

const assertNativeApiEnvironment = (
  apiDevCommand: string | undefined,
  environmentExample: string,
  bootstrap: string,
): void => {
  assert.equal(
    apiDevCommand,
    "tsx watch --env-file-if-exists=../../.env --clear-screen=false --exclude '../../node_modules/**' --exclude 'node_modules/**' --exclude '.logs/**' --exclude 'storage/**' --include '../../packages/report-persistence/src/**' --include '../../packages/shared/src/**' src/main.ts",
  );
  assert.match(bootstrap, /await app\.listen\(env\.PORT, env\.API_HOST\)/);
  assert.match(environmentExample, /^API_HOST=127\.0\.0\.1$/mu);
};

test("API source development uses the supported TypeScript loader", () => {
  const apiDevCommand = apiPackageJson.scripts.dev;
  assertNativeApiEnvironment(apiDevCommand, read(".env.example"), apiBootstrap);
});

test("native API environment guard rejects a planted public listener", () => {
  const planted = read(".env.example").replace(
    "API_HOST=127.0.0.1",
    "API_HOST=0.0.0.0",
  );
  assert.notEqual(planted, read(".env.example"));
  assert.throws(() =>
    assertNativeApiEnvironment(
      apiPackageJson.scripts.dev,
      planted,
      apiBootstrap,
    ),
  );
});

const assertNativeWebRootEnvironment = (
  scripts: Readonly<Record<string, string | undefined>>,
  environmentExample: string,
): void => {
  assert.equal(
    scripts.dev,
    "node scripts/run-next.ts dev --webpack --hostname 127.0.0.1 --port 3000",
  );
  assert.equal(scripts.build, "node scripts/run-next.ts build --webpack");
  assert.match(environmentExample, /^PORT=3002$/mu);
  assert.match(environmentExample, /^API_URL=http:\/\/localhost:3002$/mu);
};

test("native Web dev and build load the root environment contract", () => {
  assertNativeWebRootEnvironment(webPackageJson.scripts, read(".env.example"));
  assert.equal(
    existsSync(resolve("apps/web/.env.example")),
    false,
    "Web-local env examples create a second, unsupported configuration source",
  );
  assert.doesNotMatch(localEnvironment, /^NEXT_PUBLIC_API_URL=/mu);
});

test("native Web environment guard rejects a planted split-brain script", () => {
  assert.throws(() =>
    assertNativeWebRootEnvironment(
      { ...webPackageJson.scripts, dev: "next dev --webpack" },
      read(".env.example"),
    ),
  );
});

test("native Web root environment preserves explicit shell precedence", () => {
  assert.deepEqual(
    mergeNextEnvironment("API_URL=http://file\nFILE_ONLY=yes\n", {
      API_URL: "http://shell",
      SHELL_ONLY: "yes",
    }),
    {
      API_URL: "http://shell",
      FILE_ONLY: "yes",
      SHELL_ONLY: "yes",
    },
  );
});

test("native Web uses the standard NODE_ENV for each Next command", () => {
  assert.equal(
    mergeNextEnvironment("NODE_ENV=development\n", {}, "build").NODE_ENV,
    "production",
  );
  assert.equal(
    mergeNextEnvironment("NODE_ENV=production\n", {}, "dev").NODE_ENV,
    "development",
  );
});

test("Mailpit is the one local SMTP service name", () => {
  assert.match(localDependencies, /name: mailpit\n/);
  assert.match(read(".env.example"), /^SMTP_HOST=localhost$/m);
  assert.match(read(".env.example"), /^SMTP_PORT=1025$/m);
});

test("metrics documentation and edge config keep the endpoint internal", () => {
  const caddy = read("deploy/helm/weeklyreport/files/Caddyfile");
  const apiPathMatcher =
    caddy.split("\n").find((line) => line.trimStart().startsWith("path ")) ??
    "";
  assert.doesNotMatch(apiPathMatcher, /\/metrics/);
  assert.match(caddy, /@metrics path \/metrics \/metrics\/\*/);
  assert.match(caddy, /handle @metrics[\s\S]*respond "Not Found" 404/);
  const metricsHandler = caddy.indexOf("handle @metrics");
  const webFallback = caddy.indexOf("\n\thandle {", metricsHandler);
  assert.ok(
    metricsHandler !== -1 && webFallback > metricsHandler,
    "the metrics rejection must precede the catch-all web handler",
  );
  assert.match(
    operations,
    /`\/metrics`[\s\S]*internal-only|not\*\* routed through Caddy/,
  );
  assert.match(
    read("deploy/helm/weeklyreport/README.md"),
    /`\/metrics` stays internal/,
  );
});

test("the edge forwards one client address resolved right to left", () => {
  const caddy = read("deploy/helm/weeklyreport/files/Caddyfile");
  assert.match(caddy, /trusted_proxies static \{\$CADDY_TRUSTED_PROXIES\}/);
  assert.match(caddy, /trusted_proxies_strict/);
  assert.doesNotMatch(caddy, /\{remote_host\}/);
  const forwarded = caddy.match(
    /header_up X-(?:Real-IP|Forwarded-For) \{client_ip\}/g,
  );
  assert.equal(forwarded?.length, 4, "api and web both set both headers");
});

test("the edge keeps the trusted outer forwarded protocol", () => {
  const caddy = read("deploy/helm/weeklyreport/files/Caddyfile");
  assert.doesNotMatch(
    caddy,
    /header_up\s+X-Forwarded-Proto/iu,
    "trusted_proxies handling owns X-Forwarded-Proto; an override replaces the Ingress https with the inner http scheme",
  );
  assert.match(caddy, /trusted_proxies static \{\$CADDY_TRUSTED_PROXIES\}/u);
});

test("the enforcing CSP policy reports violations to the required collector", () => {
  const caddy = read("deploy/helm/weeklyreport/files/Caddyfile");
  assert.match(
    caddy,
    /Content-Security-Policy[^\n]*report-uri \{\$CADDY_CSP_REPORT_URI\}/,
  );
  assert.match(caddyReadme, /external operator-owned collector/u);
  assert.doesNotMatch(
    caddyReadme,
    /CADDY_CSP_REPORT_URI=https?:\/\/weeklyreport\.example\.com/u,
  );
});

test("integration environment documents its guarded target boundary", () => {
  assert.match(integrationEnvironment, /Guarded disposable E2E target/u);
  assert.match(
    integrationEnvironment,
    /DATABASE_URL in the process environment[\s\S]*must identify the same loopback database and port as E2E_DATABASE_URL/u,
  );
  assert.match(
    integrationEnvironment,
    /MVP single-database policy[\s\S]*weeklyreport_e2e database on loopback/u,
  );
  assert.doesNotMatch(integrationEnvironment, /^DATABASE_URL=/mu);
});

test("Grafana providers own non-overlapping current dashboard roots", () => {
  assert.match(
    operationalDashboardProvider,
    /path: \/var\/lib\/grafana\/dashboards\/weeklyreport\/operations/,
  );
  assert.match(
    productDashboardProvider,
    /path: \/var\/lib\/grafana\/dashboards\/weeklyreport\/product/,
  );
  assert.doesNotMatch(
    operationalDashboardProvider + productDashboardProvider,
    /path: \/var\/lib\/grafana\/dashboards\/weeklyreport\s*$/m,
  );
});

test("production documents the browser DSN as a build-time input", () => {
  assert.match(
    onboarding,
    /NEXT_PUBLIC_SENTRY_DSN[\s\S]*компилируется[\s\S]*новой сборки/,
  );
  assert.match(
    operations,
    /NEXT_PUBLIC_SENTRY_DSN[\s\S]*compiled into the Web image[\s\S]*new image build and deployment/,
  );
});

test("operations documentation inventories integration and coverage lanes", () => {
  assert.match(
    operations,
    /`api-integration` lane[\s\S]*Postgres\/Redis\/Mailpit/,
  );
  assert.match(
    operations,
    /`api-integration` lane[\s\S]*API coverage thresholds/u,
  );
  assert.match(operations, /`coverage` lane[\s\S]*Web coverage/u);
  assert.match(gitlabContent, /\napi-integration:/u);
  assert.match(gitlabContent, /\nmigrate-reset:/u);
  assert.match(gitlabContent, /\nnode-toolchain:/u);
  assert.equal(
    [...gitlabContent.matchAll(/@weeklyreport\/api test:coverage/gu)].length,
    1,
  );
});

const jobBlock = (name: string): string => {
  const start = gitlabContent.indexOf(`\n${name}:\n`);
  assert.ok(start !== -1, `${name} job must exist`);
  return gitlabContent.slice(start + 1).split(/\n(?=\S)/u)[0] ?? "";
};

test("the GitLab quality lane stays build-free and the build has its own job", () => {
  assert.doesNotMatch(jobBlock("quality"), /pnpm build/u);
  assert.match(gitlabCiDoc, /`production-build`/u);
});

test("production-build is a blocking route with explicit build env bound to the SHA", () => {
  const job = jobBlock("production-build");
  assert.doesNotMatch(job, /allow_failure|when: manual|when: never/u);
  assert.match(job, /^ {4}- pnpm build$/mu);
  for (const name of [
    "API_URL",
    "NEXT_PUBLIC_AUTH_STUB",
    "NEXT_PUBLIC_DEV_ROLE_SWITCHER",
    String.raw`NEXT_PUBLIC_APP_VERSION: \$CI_COMMIT_SHA`,
    "NEXT_PUBLIC_CLIENT_LOG_FORWARDING",
    "NEXT_PUBLIC_WEB_VITALS",
    "NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED",
    "NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES",
  ]) {
    assert.match(job, new RegExp(`^ {4}${name}`, "mu"), `${name} must be set`);
  }
  assert.match(job, /commit=%s.*\$CI_COMMIT_SHA/su);
  assert.match(job, /production-build-\$CI_COMMIT_SHA\.manifest/u);
});

test("dependency-scan blocks on prod and dev audits in every pipeline", () => {
  const job = jobBlock("dependency-scan");
  assert.match(job, /^ {2}needs: \[\]$/mu);
  assert.match(job, /rules:\n {4}- when: on_success\n/u);
  assert.doesNotMatch(job, /allow_failure|\|\||when: never|changes:/u);
  assert.match(job, /^ {4}- pnpm audit --prod$/mu);
  assert.match(job, /^ {4}- pnpm audit --audit-level high$/mu);
  assert.doesNotMatch(gitlabContent, /\ndependency-scan-dev:/u);
  assert.match(gitlabContent, /\nrenovate:\n/u);
});

test("secret-scan is blocking, unshallowed and checksum-verified", () => {
  const job = jobBlock("secret-scan");
  assert.match(job, /^ {2}needs: \[\]$/mu);
  assert.doesNotMatch(job, /allow_failure|when: manual|when: never/u);
  assert.match(job, /GIT_DEPTH: "0"/u);
  assert.match(job, /GITLEAKS_SHA256: [0-9a-f]{64}/u);
  assert.match(job, /sha256sum -c -/u);
  assert.match(job, /^ {4}- scripts\/gates\/secret-scan\.sh$/mu);
});

test("Vitest CI output has one labelled summary contract", () => {
  assert.match(vitestBase, /jobSummary:\s*\{\s*enabled:\s*false\s*\}/u);
  assert.match(vitestBase, /displayAnnotations:\s*true/u);
  assert.match(vitestBase, /VITEST_JSON_OUTPUT_FILE/u);
  assert.match(gitlabContent, /VITEST_JSON_OUTPUT_FILE/u);
  assert.match(gitlabContent, /ci-reports\/api-verification-summary\.md/u);
  assert.match(gitlabContent, /ci-reports\/web-coverage-summary\.md/u);
  assert.match(gitlabContent, /CI_COMMIT_SHA/u);
  assert.match(gitlabContent, /coverage-summary\.json/u);
  assert.match(gitlabContent, /throw new Error/u);
});

const assertRecoveryEvidenceIsTruthful = (document: string): void => {
  assert.match(
    document,
    /Neither value alone\s+proves achieved RPO or RTO/,
    "cadence and retention must not be presented as measured recovery evidence",
  );
  assert.doesNotMatch(
    document,
    /together they are the recovery-point objective/i,
  );
  assert.match(
    document,
    /do\s+not constitute a current restore drill or prove schema and row-count parity/,
  );
  assert.match(
    document,
    /A drill record must bind the repository SHA, dump checksum,[\s\S]*schema comparison,[\s\S]*readiness result/,
  );
};

test("recovery guidance distinguishes configuration from measured evidence", () => {
  assertRecoveryEvidenceIsTruthful(operations);
});

test("recovery guidance rejects a planted RPO overclaim", () => {
  const overclaim = operations.replace(
    "Neither value alone\nproves achieved RPO or RTO",
    "Together they are the recovery-point objective and\nprove achieved RPO or RTO",
  );
  assert.notEqual(overclaim, operations, "the planted claim must apply");
  assert.throws(() => assertRecoveryEvidenceIsTruthful(overclaim));
});

const assertAiCredentialKeyRotationBoundary = (
  operationsDocument: string,
  chartExample: string,
): void => {
  assert.match(
    operationsDocument,
    /exactly one\s+active key[\s\S]*only records with that same version/u,
  );
  assert.match(
    operationsDocument,
    /Do \*\*not\*\* treat a\s+version increment as a safe rotation/u,
  );
  assert.match(
    operationsDocument,
    /no keyring, dual-key grace period, or in-place re-encryption procedure/u,
  );
  assert.match(
    operationsDocument,
    /restore the original pair to recover[\s\S]*every provider credential must be entered again/u,
  );
  assert.match(
    chartExample,
    /current MVP supports one active key only[\s\S]*Existing credentials then cannot be decrypted/u,
  );
  assert.doesNotMatch(
    chartExample,
    /Rotate by raising the explicit key version/u,
  );
};

test("AI credential-key documentation states the single-key MVP boundary", () => {
  assertAiCredentialKeyRotationBoundary(operations, productionValues);
});

test("AI credential-key documentation rejects a planted rotation claim", () => {
  const overclaim = operations.replace(
    "Do **not** treat a\nversion increment as a safe rotation",
    "Treat a version increment as a safe rotation",
  );
  assert.notEqual(overclaim, operations, "the planted claim must apply");
  assert.throws(() =>
    assertAiCredentialKeyRotationBoundary(overclaim, productionValues),
  );
});

test("external production controls remain blocked until external read-back", () => {
  const operationsText = read("docs/operations.md");
  assert.match(operationsText, /External first-production prerequisites/);
  assert.match(operationsText, /BLOCKED/);
  [
    "alert receiver",
    "encrypted backups",
    "protected `main`",
    "immutable image",
    "immutable release record",
  ].forEach((requirement) =>
    assert.match(operationsText, new RegExp(requirement)),
  );
  assert.match(
    operationsText,
    /deploy\/helm\/weeklyreport\/observability\/[\s\S]*template/i,
  );
  assert.match(
    operationsText,
    /pgbackups[\s\S]*volume[\s\S]*repository evidence/i,
  );
  assert.match(
    operationsText,
    /production image rollback\s+is \*\*BLOCKED\*\*[\s\S]*registry and deployment read-back/i,
  );
  assert.match(
    operationsText,
    /closes the\s+image-source blocker only after the first successful image push/i,
  );
  assert.doesNotMatch(operationsText, /redeploy the previous image tag/i);
});
