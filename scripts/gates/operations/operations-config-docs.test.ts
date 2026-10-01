import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";

import { mergeNextEnvironment } from "../../../apps/web/scripts/run-next.ts";

const read = (path: string): string => readFileSync(resolve(path), "utf8");
const prodCompose = read("docker-compose.prod.yml");
const operations = read("docs/operations.md");
const onboarding = read("docs/onboarding.md");
const readme = read("README.md");
const localEnvironment = read(".env.example");
const integrationEnvironment = read(".env.test.example");
const productionEnvironment = read("deploy/environment/production.env.example");
const compose = read("docker-compose.yml");
const devCompose = read("docker-compose.dev.yml");
const observabilityCompose = read("docker-compose.observability.yml");
const errorsCompose = read("docker-compose.errors.yml");
const environmentDocs = read("docs/environment.md");
const operationalDashboardProvider = read(
  "deploy/grafana/provisioning/dashboards/customreport.yml",
);
const productDashboardProvider = read(
  "deploy/grafana/provisioning/dashboards/product-telemetry.yml",
);
const productionPrometheus = read("deploy/prometheus-otel-lgtm.yml");
const developmentPrometheus = read("deploy/prometheus-otel-lgtm.dev.yml");
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

const requiredProductionVariables = (): readonly string[] =>
  [...prodCompose.matchAll(/\$\{([A-Z0-9_]+):\?/g)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
    .filter((name, index, names) => names.indexOf(name) === index);

const assertFirstDeployVariableTable = (document: string): void => {
  const lines = document.split("\n");
  const tableStart = lines.findIndex((line) =>
    /^ {3}\| Variable\s+\|/u.test(line),
  );
  assert.notEqual(
    tableStart,
    -1,
    "first deploy must contain an indented variable table",
  );
  const tableEndOffset = lines
    .slice(tableStart)
    .findIndex((line) => !/^ {3}\|/u.test(line));
  const tableEnd =
    tableEndOffset === -1 ? lines.length : tableStart + tableEndOffset;
  const table = lines.slice(tableStart, tableEnd).join("\n");

  for (const variable of requiredProductionVariables()) {
    assert.match(
      table,
      new RegExp(String.raw`\b${variable}\b`),
      `${variable} is required by docker-compose.prod.yml but missing from the first-deploy variable table`,
    );
  }
};

test("first-deploy documentation lists every required production variable", () => {
  assertFirstDeployVariableTable(operations);
});

test("first-deploy variable-table assertion rejects a broken Markdown row", () => {
  const malformed = operations.replace(
    "\n   | `POSTGRES_DB`",
    "\n\n| `POSTGRES_DB`",
  );
  assert.notEqual(malformed, operations, "the planted row must exist");
  assert.throws(
    () => assertFirstDeployVariableTable(malformed),
    /POSTGRES_DB.*missing from the first-deploy variable table/,
  );
});

const assertLocalBootstrapContract = (
  environmentExample: string,
  quickStart: string,
): void => {
  const target =
    "postgresql://customreport:localdev@localhost:5432/customreport_e2e";
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
    compose,
    /postgresql:\/\/customreport:localdev@postgres:5432\/customreport_e2e/u,
  );
  assert.match(compose, /POSTGRES_DB: customreport_e2e/u);
  assert.match(compose, /pg_isready -U customreport -d postgres/u);
  assert.ok(localEnvironment.includes("POSTGRES_DB=customreport_e2e"));
};

test("local quick start bootstraps one exact guarded database", () => {
  assertLocalBootstrapContract(localEnvironment, readme);
});

test("local bootstrap contract rejects target and consent drift", () => {
  const wrongTarget = localEnvironment.replaceAll(
    "/customreport_e2e",
    "/customreport_dev",
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
  assert.match(compose, /API_HOST: 0\.0\.0\.0/);
  assert.match(prodCompose, /API_HOST: 0\.0\.0\.0/);
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
  assert.match(compose, /target: installer/u);
  assert.equal(
    compose.split("\n").some((line) => line.trim() === "args:"),
    false,
    "the installer dev target must not advertise builder-only arguments",
  );
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
  assert.match(compose, /\n {2}mailpit:\n/);
  assert.match(compose, /SMTP_HOST: mailpit/);
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

test("the enforcing CSP policy reports violations to the required collector", () => {
  const caddy = read("deploy/helm/weeklyreport/files/Caddyfile");
  assert.match(
    caddy,
    /Content-Security-Policy[^\n]*report-uri \{\$CADDY_CSP_REPORT_URI\}/,
  );
  assert.match(caddyReadme, /external operator-owned collector/u);
  assert.doesNotMatch(
    caddyReadme,
    /CADDY_CSP_REPORT_URI=https?:\/\/customreport\.example\.com/u,
  );
});

test("production Compose mounts the sole Caddy policy", () => {
  assert.match(
    prodCompose,
    /- \.\/deploy\/helm\/weeklyreport\/files\/Caddyfile:\/etc\/caddy\/Caddyfile:ro/,
  );
});

test("production Compose examples always load the production environment", () => {
  const examples = [operations, caddyReadme]
    .flatMap((document) => document.split("\n"))
    .filter(
      (line) =>
        line.includes("docker compose") &&
        line.includes("docker-compose.prod.yml"),
    );
  assert.ok(examples.length > 0);
  examples.forEach((line) =>
    assert.match(
      line,
      /--env-file \.env\.production/,
      `production Compose example lacks --env-file: ${line}`,
    ),
  );
});

test("production Caddy variables have one production-only source", () => {
  for (const variable of [
    "CADDY_SITE_ADDRESS",
    "CADDY_ACME_EMAIL",
    "CADDY_CSP_REPORT_URI",
  ]) {
    assert.ok(prodCompose.includes(`${variable}: \${${variable}:?`));
    assert.match(productionEnvironment, new RegExp(`^${variable}=$`, "m"));
    assert.doesNotMatch(localEnvironment, new RegExp(`^${variable}=`, "m"));
  }
});

test("observability has explicit local and production Grafana contracts", () => {
  assert.match(localEnvironment, /^GRAFANA_PORT=3003$/m);
  assert.match(localEnvironment, /^GRAFANA_ADMIN_USER=admin$/m);
  assert.match(
    localEnvironment,
    /^GRAFANA_ADMIN_PASSWORD=\S+$/m,
    "the copied local environment must render observability:up",
  );
  assert.match(
    observabilityCompose,
    /GRAFANA_ADMIN_PASSWORD:\?GRAFANA_ADMIN_PASSWORD must be set/,
  );
  assert.match(
    onboarding,
    /pnpm observability:up[\s\S]*GRAFANA_ADMIN_PASSWORD/,
  );
  assert.match(productionEnvironment, /^GRAFANA_ADMIN_PASSWORD=$/m);
  assert.match(
    operations,
    /observability overlay[\s\S]*GRAFANA_ADMIN_PASSWORD[\s\S]*no password default/i,
  );
  assert.match(environmentDocs, /`GRAFANA_PORT`[\s\S]*`GRAFANA_ADMIN_USER`/u);
  assert.match(environmentDocs, /host ports are loopback-only/u);
});

test("local observability extends one Compose project without duplicate ports", () => {
  const composeCommand = packageJson.scripts["observability:compose"] ?? "";
  const downCommand = packageJson.scripts["observability:down"] ?? "";

  assert.doesNotMatch(composeCommand, /--project-name/u);
  assert.match(
    downCommand,
    /rm --stop --force otel-lgtm bugsink postgres-exporter redis-exporter/u,
  );
  assert.match(
    devCompose,
    /OTEL_EXPORTER_OTLP_ENDPOINT: http:\/\/otel-lgtm:4318/u,
  );
  assert.doesNotMatch(devCompose, /host\.docker\.internal/u);
  assert.match(environmentDocs, /reuses its PostgreSQL, Redis, and Mailpit/u);
});

test("local Bugsink overlay has an explicit secret contract", () => {
  assert.match(localEnvironment, /^BUGSINK_PORT=8000$/m);
  assert.match(
    localEnvironment,
    /^BUGSINK_SECRET_KEY=localdev-insecure-key-for-local-dev-only-change-in-prod-2025$/m,
  );
  assert.match(errorsCompose, /BUGSINK_PORT:-8000/u);
  assert.match(
    errorsCompose,
    /BUGSINK_SECRET_KEY:\?BUGSINK_SECRET_KEY must be set/u,
  );
  assert.match(
    environmentDocs,
    /`BUGSINK_SECRET_KEY`[\s\S]*no Compose fallback[\s\S]*local-only/u,
  );
  assert.match(
    operations,
    /Bugsink errors overlay[\s\S]*BUGSINK_PORT[\s\S]*BUGSINK_SECRET_KEY[\s\S]*not part of the production Compose command/u,
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
    /MVP single-database policy[\s\S]*customreport_e2e database on loopback/u,
  );
  assert.doesNotMatch(integrationEnvironment, /^DATABASE_URL=/mu);
});

test("Grafana providers own non-overlapping current dashboard roots", () => {
  assert.match(
    observabilityCompose,
    /dashboards\/customreport\/operations\/customreport-dashboard\.json/,
  );
  assert.match(
    observabilityCompose,
    /dashboards\/customreport\/operations\/trpc-latency-dashboard\.json/,
  );
  assert.match(
    observabilityCompose,
    /dashboards\/customreport\/product\/product-telemetry-dashboard\.json/,
  );
  assert.match(
    operationalDashboardProvider,
    /path: \/var\/lib\/grafana\/dashboards\/customreport\/operations/,
  );
  assert.match(
    productDashboardProvider,
    /path: \/var\/lib\/grafana\/dashboards\/customreport\/product/,
  );
  assert.doesNotMatch(
    operationalDashboardProvider + productDashboardProvider,
    /path: \/var\/lib\/grafana\/dashboards\/customreport\s*$/m,
  );
  assert.match(productionPrometheus, /cluster: customreport-production/);
  assert.match(developmentPrometheus, /cluster: customreport-local/);
  assert.match(
    operations,
    /two non-overlapping dashboard roots[\s\S]*cluster=customreport-production[\s\S]*cluster=customreport-local/,
  );
});

test("development Compose uses the canonical Sentry variable names", () => {
  assert.match(devCompose, /SENTRY_DSN: \$\{SENTRY_DSN:-\}/);
  assert.match(
    devCompose,
    /NEXT_PUBLIC_SENTRY_DSN: \$\{NEXT_PUBLIC_SENTRY_DSN:-\}/,
  );
  assert.doesNotMatch(devCompose, /SENTRY_DSN_[A-Z]/);
});

test("production documents the browser DSN as a build-time input", () => {
  assert.match(
    prodCompose,
    /NEXT_PUBLIC_SENTRY_DSN: \$\{NEXT_PUBLIC_SENTRY_DSN:-\}/,
  );
  assert.match(productionEnvironment, /^# NEXT_PUBLIC_SENTRY_DSN=https:\/\//m);
  assert.match(
    onboarding,
    /NEXT_PUBLIC_SENTRY_DSN[\s\S]*компилируется[\s\S]*новой сборки/,
  );
  assert.match(
    operations,
    /NEXT_PUBLIC_SENTRY_DSN[\s\S]*compiled into the Web image[\s\S]*up --build/,
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
    [...gitlabContent.matchAll(/@customreport\/api test:coverage/gu)].length,
    1,
  );
});

test("the GitLab quality lane carries no product build", () => {
  // Per the owner decision the product build is documented as required
  // evidence outside CI instead.
  const gitlabQuality = gitlabContent.slice(
    gitlabContent.indexOf("\nquality:"),
    gitlabContent.indexOf("\ndependency-scan:"),
  );
  assert.doesNotMatch(gitlabQuality, /pnpm build/u);
  assert.match(gitlabCiDoc, /product build[\s\S]*outside CI/u);
});

test("dependency-scan also runs on merge requests that change dependency manifests", () => {
  const start = gitlabContent.indexOf("\ndependency-scan:");
  const next = gitlabContent.slice(start + 1).search(/\n[a-z.][\w.-]*:\n/u);
  const end = next === -1 ? gitlabContent.length : start + 1 + next;
  const job = gitlabContent.slice(start, end);
  const mrRule = /merge_request_event"'\s+changes:\n((?:\s+- .+\n)+)/u.exec(
    job,
  )?.[1];
  assert.ok(mrRule, "dependency-scan must run on merge requests with changes");
  const scan = mrRule;
  for (const manifest of [
    "pnpm-lock.yaml",
    "package.json",
    "pnpm-workspace.yaml",
  ]) {
    assert.ok(
      scan.includes(`- ${manifest}`),
      `${manifest} must trigger the scan`,
    );
  }
  // Production advisories block; development-tool advisories only report.
  assert.match(job, /^ {4}- pnpm audit --prod$/mu);
  assert.doesNotMatch(job, /pnpm audit --dev/u);
  // The dev audit is its own job: a failure warns but is never hidden by `||`.
  const devStart = gitlabContent.indexOf("\ndependency-scan-dev:");
  assert.ok(devStart > start, "dependency-scan-dev job must exist");
  const devJob = gitlabContent.slice(devStart + 1).split(/\n(?=\S)/u)[0] ?? "";
  assert.match(devJob, /extends: dependency-scan\b/u);
  assert.match(devJob, /allow_failure: true/u);
  assert.match(devJob, /^ {4}- pnpm audit --dev --audit-level high$/mu);
  assert.doesNotMatch(devJob, /\|\|/u);
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
  productionTemplate: string,
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
    productionTemplate,
    /current MVP supports one active key only[\s\S]*Existing credentials then cannot be decrypted/u,
  );
  assert.doesNotMatch(
    productionTemplate,
    /Rotate by raising the explicit key version/u,
  );
};

test("AI credential-key documentation states the single-key MVP boundary", () => {
  assertAiCredentialKeyRotationBoundary(operations, productionEnvironment);
});

test("AI credential-key documentation rejects a planted rotation claim", () => {
  const overclaim = operations.replace(
    "Do **not** treat a\nversion increment as a safe rotation",
    "Treat a version increment as a safe rotation",
  );
  assert.notEqual(overclaim, operations, "the planted claim must apply");
  assert.throws(() =>
    assertAiCredentialKeyRotationBoundary(overclaim, productionEnvironment),
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
    /docker-compose\.observability\.yml[\s\S]*deploy\/prometheus-otel-lgtm\.yml[\s\S]*deploy\/alert-rules\.yml[\s\S]*template/i,
  );
  assert.match(
    operationsText,
    /pgbackups[\s\S]*volume[\s\S]*repository evidence/i,
  );
  assert.match(
    operationsText,
    /production image rollback is \*\*BLOCKED\*\*[\s\S]*builds from the checked-out\s+source/i,
  );
  assert.match(
    operationsText,
    /closes the\s+image-source blocker only after the first successful image push/i,
  );
  assert.doesNotMatch(operationsText, /redeploy the previous image tag/i);
});
