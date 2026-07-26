import { existsSync } from "node:fs";
import * as path from "node:path";

import type { PlaywrightTestConfig } from "@playwright/test";

import baseConfig, {
  DEFAULT_E2E_API_PORT,
  DEFAULT_E2E_WEB_PORT,
} from "./playwright.integration.config";

/**
 * Runs the SAME integration suite against production build artifacts:
 * - api: the compiled `dist` entry (what Dockerfile.api ships), run from
 *   apps/api as its cwd to mirror the image's WORKDIR-relative contracts
 *   (PDF_OUTPUT_DIR et al. resolve against apps/api/ in the container)
 * - web: the Next.js standalone server (the exact entrypoint Dockerfile.web ships)
 *
 * Invoke via the root `test:e2e:prodbuild` script — it builds with the API
 * origin pinned to the integration API port and copies `.next/static` into the
 * standalone dir (mirroring Dockerfile.web). Because rewrites and NEXT_PUBLIC_*
 * are inlined at build time, the port overrides the dev config honours are NOT
 * supported here (guarded below): the ports are baked at build.
 *
 * The api keeps NODE_ENV=test + AUTH_DEV_MODE=true from the base config —
 * env.schema forbids dev-login under NODE_ENV=production, and the suite's
 * fixtures authenticate through /auth/dev-login. What this run verifies is the
 * production ARTIFACTS (compiled output, standalone server, baked rewrites),
 * not the production auth path.
 */
const repoRoot = path.join(import.meta.dirname, "..");

const portOverrides = ["E2E_API_PORT", "E2E_WEB_PORT"].filter(
  (key) =>
    process.env[key] !== undefined &&
    process.env[key] !==
      String(
        key === "E2E_API_PORT" ? DEFAULT_E2E_API_PORT : DEFAULT_E2E_WEB_PORT,
      ),
);
if (portOverrides.length > 0) {
  throw new Error(
    `prodbuild e2e bakes ports ${DEFAULT_E2E_API_PORT}/${DEFAULT_E2E_WEB_PORT} into the client bundle at build time — unset ${portOverrides.join(", ")} (unsupported here, unlike the dev-server config)`,
  );
}

const REQUIRED_ARTIFACTS = [
  "apps/api/dist/apps/api/src/main.js",
  "apps/web/.next/standalone/apps/web/server.js",
  "apps/web/.next/standalone/apps/web/.next/static",
] as const;
const missingArtifacts = REQUIRED_ARTIFACTS.filter(
  (rel) => !existsSync(path.join(repoRoot, rel)),
);
if (missingArtifacts.length > 0) {
  throw new Error(
    `prodbuild e2e artifacts missing: ${missingArtifacts.join(", ")} — run via \`pnpm test:e2e:prodbuild\` (it rebuilds and stages them); a direct playwright invocation would test stale or absent builds`,
  );
}

type WebServerEntry = Extract<
  Exclude<PlaywrightTestConfig["webServer"], undefined | null>,
  readonly unknown[]
>[number];

const baseServers: readonly WebServerEntry[] = Array.isArray(
  baseConfig.webServer,
)
  ? baseConfig.webServer
  : [];

if (baseServers.length !== 2) {
  throw new Error(
    "playwright.integration.config.ts no longer exposes the expected [api, web] webServer pair — update playwright.prodbuild.config.ts alongside it",
  );
}

// Deterministic dev-login-only SAML posture: the dev-server run inherits
// KEYCLOAK_* from the repo .env via --env-file-if-exists; this run must not
// depend on whatever the invoking shell exports. The keys are REMOVED (not
// blanked): env.schema validates a present value, so "" would fail z.url().
const withoutSamlEnv = (
  env: WebServerEntry["env"],
): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(env ?? {}).filter(
      ([key]) => !key.startsWith("KEYCLOAK_SAML_"),
    ),
  );

const toProdServer = (entry: WebServerEntry): WebServerEntry =>
  entry.command.includes("@customreport/api")
    ? {
        ...entry,
        cwd: path.join(repoRoot, "apps/api"),
        command: "node dist/apps/api/src/main.js",
        env: withoutSamlEnv(entry.env) as NonNullable<WebServerEntry["env"]>,
      }
    : {
        ...entry,
        cwd: repoRoot,
        command: "node apps/web/.next/standalone/apps/web/server.js",
        env: {
          ...entry.env,
          NODE_ENV: "production",
          PORT: String(DEFAULT_E2E_WEB_PORT),
          HOSTNAME: "127.0.0.1",
        },
      };

export default {
  ...baseConfig,
  webServer: baseServers.map(toProdServer),
};
