import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const browserConfig = readFileSync(
  resolve("apps/web/instrumentation-client.ts"),
  "utf8",
);
const sentryConfig = readFileSync(
  resolve("apps/web/sentry-options.config.ts"),
  "utf8",
);
const tunnelRoute = resolve("apps/web/src/app/monitoring/route.ts");
const tunnelImplementation = resolve(
  "apps/web/src/app/monitoring/sentry-tunnel.ts",
);
const tunnelRouteSource = readFileSync(tunnelRoute, "utf8");
const productionCaddy = readFileSync(resolve("deploy/caddy/Caddyfile"), "utf8");
const stagingCaddy = readFileSync(
  resolve("deploy/caddy/Caddyfile.staging"),
  "utf8",
);
const productionCompose = readFileSync(
  resolve("docker-compose.prod.yml"),
  "utf8",
);

void test("browser telemetry uses the repository same-origin tunnel", () => {
  assert.ok(existsSync(tunnelRoute), "the Next route handler must exist");
  assert.match(sentryConfig, /BROWSER_SENTRY_TUNNEL = "\/monitoring"/);
  assert.match(browserConfig, /tunnel: BROWSER_SENTRY_TUNNEL/);
  assert.match(
    readFileSync(tunnelImplementation, "utf8"),
    /resolveSentryEnvelopeEndpoint/,
  );
});

void test("the public tunnel has bounded per-client quota enforcement", () => {
  const implementation = readFileSync(tunnelImplementation, "utf8");
  assert.match(tunnelRouteSource, /consumeSentryTunnelQuota/);
  assert.match(implementation, /SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW = 30/);
  assert.match(implementation, /SENTRY_TUNNEL_MAX_CLIENT_BUCKETS = 1024/);
  assert.match(implementation, /new Map<string, ClientQuotaBucket>/);
});

void test("the enforcing edge CSP keeps connect-src same-origin only", () => {
  for (const [name, caddyfile] of [
    ["production", productionCaddy],
    ["staging", stagingCaddy],
  ] as const) {
    const policies = caddyfile.match(/Content-Security-Policy "[^"]+"/g) ?? [];
    assert.ok(policies.length > 0, `${name} must declare a CSP policy`);
    for (const policy of policies) {
      const connectDirective = /connect-src ([^;"]+)/.exec(policy)?.[1];
      assert.equal(connectDirective, "'self'");
    }
  }
});

void test("the edge leaves the tunnel path on the web service", () => {
  for (const [name, caddyfile] of [
    ["production", productionCaddy],
    ["staging", stagingCaddy],
  ] as const) {
    const apiPathMatcher =
      caddyfile
        .split("\n")
        .find((line) => line.trimStart().startsWith("path ")) ?? "";
    assert.doesNotMatch(
      apiPathMatcher,
      /(?:^|\s)\/monitoring(?:\/|\*|\s|$)/,
      `${name} must not route /monitoring to the API service`,
    );
  }
});

void test("production supplies the server-side DSN to the Next tunnel", () => {
  assert.match(productionCompose, /SENTRY_DSN: \$\{SENTRY_DSN:-\}/);
});
