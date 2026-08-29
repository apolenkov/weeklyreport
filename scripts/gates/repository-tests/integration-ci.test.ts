import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
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

void test("CI keeps a serial, disposable API integration lane with live dependencies", () => {
  assert.match(workflow, /api-integration:/);
  assert.match(
    workflow,
    /E2E_DATABASE_URL: postgresql:\/\/customreport:localdev@localhost:5432\/customreport_e2e/,
  );
  assert.match(
    workflow,
    /DATABASE_URL: postgresql:\/\/customreport:localdev@localhost:5432\/customreport_generate_only/,
  );
  assert.match(workflow, /REDIS_DB: ["']?15["']?/);
  assert.match(workflow, /REQUIRED_INTEGRATION_DEPS: ["']?true["']?/);
  assert.match(workflow, /SMTP_HOST: localhost/);
  assert.match(workflow, /SMTP_PORT: ["']?1025["']?/);
  assert.match(workflow, /pnpm --filter @customreport\/api test:integration/);
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

void test("CI exposes explicit API and Web coverage jobs without changing suite floors", () => {
  assert.match(workflow, /coverage:/);
  assert.match(workflow, /pnpm test:coverage/);
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

void test("the fast root test command remains the unit contour", () => {
  assert.equal(
    rootPackage.scripts.test,
    "turbo run test && vitest run --config vitest.prisma.config.ts",
  );
  assert.doesNotMatch(rootPackage.scripts.test, /coverage|integration/);
});
