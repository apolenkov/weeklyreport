import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string): string => readFileSync(resolve(path), "utf8");
const prodCompose = read("docker-compose.prod.yml");
const operations = read("docs/operations.md");
const onboarding = read("docs/onboarding.md");
const readme = read("README.md");
const compose = read("docker-compose.yml");
const devCompose = read("docker-compose.dev.yml");
const caddyReadme = read("deploy/caddy/README.md");
const errorsCompose = read("docker-compose.errors.yml");
const packageJson = JSON.parse(read("package.json")) as {
  readonly scripts: Readonly<Record<string, string | undefined>>;
};
const apiPackageJson = JSON.parse(read("apps/api/package.json")) as {
  readonly scripts: Readonly<Record<string, string | undefined>>;
};
const workflow = read(".github/workflows/ci.yml");

const requiredProductionVariables = (): readonly string[] =>
  [...prodCompose.matchAll(/\$\{([A-Z0-9_]+):\?/g)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
    .filter((name, index, names) => names.indexOf(name) === index);

void test("first-deploy documentation lists every required production variable", () => {
  requiredProductionVariables().forEach((variable) => {
    assert.match(
      operations,
      new RegExp(String.raw`\b${variable}\b`),
      `${variable} is required by docker-compose.prod.yml but missing from docs/operations.md`,
    );
  });
});

void test("the observability command leaves api and web to source development", () => {
  const command = packageJson.scripts["observability:up"];
  assert.equal(
    command,
    "pnpm observability:compose up -d postgres redis mailpit otel-lgtm bugsink",
  );
  assert.doesNotMatch(command, /\b(api|web)\b/);
  assert.match(readme, /единственный\s+владелец\s+—\s+pnpm dev/);
  assert.match(onboarding, /не запускает[\s\S]*`api` и `web`/);
});

void test("observability commands own an isolated Compose project", () => {
  const command = packageJson.scripts["observability:compose"] ?? "";
  assert.match(command, /--project-name customreport-observability/);
  assert.equal(
    packageJson.scripts["observability:down"],
    "pnpm observability:compose down",
  );
});

void test("API source development uses the supported TypeScript loader", () => {
  const apiDevCommand = apiPackageJson.scripts.dev;
  assert.match(apiDevCommand ?? "", /--import tsx --watch src\/main\.ts/);
  assert.match(devCompose, /--import tsx[\s\S]*--watch src\/main\.ts/);
  assert.doesNotMatch(
    `${apiDevCommand ?? ""}\n${devCompose}`,
    /@swc-node\/register/,
  );
});

void test("Mailpit is the one local SMTP service name", () => {
  assert.match(compose, /\n {2}mailpit:\n/);
  assert.doesNotMatch(`${compose}\n${devCompose}`, /mailhog/i);
  assert.match(`${compose}\n${devCompose}`, /SMTP_HOST: mailpit/);
  assert.match(devCompose, /SMTP_PORT: ["']?1025["']?/);
  assert.match(read(".env.example"), /^SMTP_HOST=localhost$/m);
  assert.match(read(".env.example"), /^SMTP_PORT=1025$/m);
  assert.match(
    read(".env.example"),
    /^OTEL_EXPORTER_OTLP_ENDPOINT=http:\/\/localhost:4318$/m,
  );
  assert.match(
    devCompose,
    /OTEL_EXPORTER_OTLP_ENDPOINT: http:\/\/host\.docker\.internal:4318/,
  );
});

void test("metrics documentation and edge config keep the endpoint internal", () => {
  const caddy = read("deploy/caddy/Caddyfile");
  const stagingCaddy = read("deploy/caddy/Caddyfile.staging");
  for (const policy of [caddy, stagingCaddy]) {
    const apiPathMatcher =
      policy.split("\n").find((line) => line.trimStart().startsWith("path ")) ??
      "";
    assert.doesNotMatch(apiPathMatcher, /\/metrics/);
  }
  for (const policy of [caddy, stagingCaddy]) {
    assert.match(policy, /@metrics path \/metrics \/metrics\/\*/);
    assert.match(policy, /handle @metrics[\s\S]*respond "Not Found" 404/);
    const metricsHandler = policy.indexOf("handle @metrics");
    const webFallback = policy.indexOf("\n\thandle {", metricsHandler);
    assert.ok(
      metricsHandler !== -1 && webFallback > metricsHandler,
      "the metrics rejection must precede the catch-all web handler",
    );
  }
  assert.match(
    operations,
    /`\/metrics`[\s\S]*internal-only|not\*\* routed through Caddy/,
  );
  assert.match(read("deploy/caddy/README.md"), /`\/metrics` stays internal/);
});

void test("both enforcing CSP policies report violations to the required collector", () => {
  const caddy = read("deploy/caddy/Caddyfile");
  const stagingCaddy = read("deploy/caddy/Caddyfile.staging");
  for (const policy of [caddy, stagingCaddy]) {
    assert.match(
      policy,
      /Content-Security-Policy[^\n]*report-uri \{\$CADDY_CSP_REPORT_URI\}/,
    );
  }
});

void test("production Caddy selection and Prometheus ownership are explicit", () => {
  assert.match(
    prodCompose,
    /- \$\{CADDY_FILE:-\.\/deploy\/caddy\/Caddyfile\}:\/etc\/caddy\/Caddyfile:ro/,
  );
  assert.match(
    read("deploy/caddy/Caddyfile.staging"),
    /CADDY_FILE=.*Caddyfile\.staging/,
  );
  assert.match(
    read("deploy/prometheus.yml"),
    /Standalone Prometheus.*template/,
  );
  assert.match(
    read("deploy/prometheus.yml"),
    /not mounted by docker-compose\.observability\.yml/,
  );
  assert.match(read("deploy/prometheus-otel-lgtm.yml"), /Compose-owned/);
});

void test("production Compose examples always load the production environment", () => {
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

void test("Bugsink is bound to loopback by default", () => {
  assert.match(errorsCompose, /127\.0\.0\.1:\$\{BUGSINK_PORT:-8000\}:8000/);
  assert.match(errorsCompose, /loopback/);
  assert.match(caddyReadme, /\.env\.production/);
});

void test("production Caddy ACME email is fail-closed and documented", () => {
  assert.match(prodCompose, /CADDY_ACME_EMAIL: \$\{CADDY_ACME_EMAIL:\?/);
  assert.match(read(".env.example"), /^CADDY_ACME_EMAIL=\S+$/m);
});

void test("operations documentation inventories integration and coverage lanes", () => {
  assert.match(
    operations,
    /`api-integration` lane[\s\S]*Postgres\/Redis\/Mailpit/,
  );
  assert.match(operations, /`coverage` lane[\s\S]*API and Web/);
  assert.match(workflow, /api-integration:/);
  assert.match(workflow, /coverage:/);
});

void test("Grafana guidance uses the configured password", () => {
  assert.doesNotMatch(`${readme}\n${onboarding}`, /admin.*admin/);
  assert.match(`${readme}\n${onboarding}`, /GRAFANA_ADMIN_PASSWORD/);
});

void test("external production controls remain blocked until external read-back", () => {
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
  assert.match(operationsText, /alertmanager\.yml[\s\S]*template/i);
  assert.match(
    operationsText,
    /pgbackups[\s\S]*volume[\s\S]*repository evidence/i,
  );
  assert.match(
    operationsText,
    /production image rollback is \*\*BLOCKED\*\*[\s\S]*no image-tag input/i,
  );
  assert.doesNotMatch(operationsText, /redeploy the previous image tag/i);
});
