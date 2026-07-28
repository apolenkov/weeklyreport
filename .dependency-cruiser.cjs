/**
 * Module-graph gate. The ESLint import-boundary zones own directional rules;
 * dependency-cruiser owns what ESLint cannot see — the whole graph at once.
 * Run via `pnpm depcruise`.
 *
 * tsPreCompilationDeps stays false: only RUNTIME cycles gate. Type-only cycles
 * are erased by compilation, so they are burn-down rather than a gate; measure
 * them by re-running with `tsPreCompilationDeps: true`.
 *
 * Every rule is at severity `error` deliberately: depcruise's exit code counts
 * errors only, so a rule left at its shipped `warn` would be decorative.
 */

// apps/api is hexagonal: domain (pure) <- application (use cases) <- infrastructure
// (adapters). ESLint's import-boundary zones ban adapter PACKAGE names inside
// domain/; they cannot see a relative `../infrastructure/x.js`, which is what
// these three rules close.
const API_DOMAIN = "^apps/api/src/modules/[^/]+/domain/";
const API_APPLICATION = "^apps/api/src/modules/[^/]+/application/";
const API_INFRA =
  "^apps/api/src/(?:infrastructure/|modules/[^/]+/infrastructure/)";
const TESTISH =
  "(?:[.](?:spec|test)[.][cm]?[jt]sx?$|__tests__/|__fixtures__/|/test-utils/|[.]fixtures[.]ts$)";

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular imports make initialization order load-bearing and break refactoring.",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "An import that does not resolve to disk is a broken or undeclared dependency.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-non-package-json",
      severity: "error",
      comment:
        "An npm import absent from every workspace manifest is either missing on live or present at an unpinned version.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "not-to-spec",
      severity: "error",
      comment:
        "A production module importing a test file gives that file a second responsibility; extract the shared part instead.",
      from: {},
      to: { path: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$" },
    },
    {
      name: "no-deprecated-core",
      severity: "error",
      comment:
        "Node does not deprecate core modules lightly; a replacement always exists.",
      from: {},
      to: {
        dependencyTypes: ["core"],
        path: [
          "^v8/tools/codemap$",
          "^v8/tools/consarray$",
          "^v8/tools/csvparser$",
          "^v8/tools/logreader$",
          "^v8/tools/profile_view$",
          "^v8/tools/profile$",
          "^v8/tools/SourceMap$",
          "^v8/tools/splaytree$",
          "^v8/tools/tickprocessor-driver$",
          "^v8/tools/tickprocessor$",
          "^node-inspect/lib/_inspect$",
          "^node-inspect/lib/internal/inspect_client$",
          "^node-inspect/lib/internal/inspect_repl$",
          "^punycode$",
          "^domain$",
          "^constants$",
          "^sys$",
          "^_linklist$",
          "^_stream_wrap$",
        ],
      },
    },
    {
      name: "hexagon-domain-not-to-infrastructure",
      severity: "error",
      comment:
        "domain/ is the innermost layer; importing an adapter inverts the dependency. No test exemption: domain logic is pure, so its tests need no adapter either — measured 0 with and without the exemption.",
      from: { path: API_DOMAIN },
      to: { path: API_INFRA },
    },
    {
      name: "hexagon-domain-not-to-application",
      severity: "error",
      comment:
        "domain/ must not know its own use cases; the edge runs application -> domain only.",
      from: { path: API_DOMAIN },
      to: { path: API_APPLICATION },
    },
    {
      name: "hexagon-application-not-to-infrastructure",
      severity: "error",
      comment:
        "application/ reaches an adapter through a port it owns, never by importing the adapter. Tests are exempt on the FROM side only: the 13 such edges are all *.test.ts wiring a real adapter, which is composition rather than coupling.",
      from: { path: API_APPLICATION, pathNot: TESTISH },
      to: { path: API_INFRA },
    },
  ],
  required: [
    {
      name: "router-uses-canonical-procedure-chain",
      severity: "error",
      comment:
        "Role-coverage gate, floor only: a tRPC router must take its procedures from trpc.middleware.ts, home of the 8 canonical chain builders. `required` proves an edge exists, not that every procedure uses one — reference identity stays a review concern.",
      module: {
        path: "^apps/api/src/infrastructure/trpc/routers/.+[.]router[.]ts$",
      },
      to: { path: "^apps/api/src/infrastructure/trpc/trpc[.]middleware[.]ts$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: false,
    tsConfig: { fileName: "tsconfig.base.json" },
    // pnpm hoists shared deps to the root manifest, so resolving against the
    // nearest package.json alone reports declared packages as undeclared.
    combinedDependencies: true,
    // ESM-only deps (cookie, react-email) publish an exports map and no
    // main/module field; without these conditions they read as unresolvable.
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types"],
      extensions: [
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
        ".ts",
        ".tsx",
        ".mts",
        ".cts",
      ],
    },
  },
};
