import * as path from "node:path";

import prodbuildConfig from "./playwright.prodbuild.config";

/**
 * CSP validation against PRODUCTION artifacts.
 *
 * It has to be the production build. Run against `next dev`, the walk reports
 * `script-src blocked eval` on every route — from the turbopack dev runtime and
 * a dev-only zod chunk, neither of which ships. Validating the production
 * policy against development bundles answers a question nobody asked.
 *
 * Reuses the prodbuild servers (compiled api + Next standalone) and its
 * reset-and-seed global setup, redirecting only test discovery, so the bundles
 * under test are byte-for-byte the ones the image serves.
 *
 * Invoke via `pnpm test:e2e:csp` — it stages the build the same way the
 * prodbuild suite does.
 */
export default {
  ...prodbuildConfig,
  testDir: path.join(import.meta.dirname, "csp"),
  // The inherited projects exist to split desktop from the @MOB- tagged mobile
  // specs; this suite has neither, and a policy is not viewport-dependent.
  projects: undefined,
};
