import type { Linter } from "eslint";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";

const apiModulesDir = "apps/api/src/modules";
const apiModules = [
  "activity",
  "admin",
  "analytics",
  "archive",
  "auth",
  "carry-over",
  "email",
  "observability",
  "organization",
  "pdf-export",
  "period",
  "project-activity",
  "publication",
  "reminders",
  "report-sections",
  "review",
  "search",
  "telegram",
  "telemetry",
  "weekly-report",
] as const;

// One zone per module: files under modules/M may import from modules/ ONLY within
// their own module (except: [M]), or through a sibling's index.ts facade barrel.
// Any other sibling internal path errors. The barrel allowlist is GENERATED
// (every sibling's index.ts), so a new module→module edge is legal the moment it
// targets the facade — no per-edge grandfathering to maintain.
const apiCrossModuleZones = apiModules.map((moduleName) => ({
  target: `${apiModulesDir}/${moduleName}`,
  from: apiModulesDir,
  except: [
    moduleName,
    ...apiModules
      .filter((sibling) => sibling !== moduleName)
      .map((sibling) => `${sibling}/index.ts`),
  ],
  message: `api module boundary: '${moduleName}' may reach a sibling module only through its index.ts facade barrel, never an internal path (restructure-directory-architecture).`,
}));

const apiInfrastructureModuleZones = [
  "apps/api/src/infrastructure",
  "apps/api/src/bootstrap",
  "apps/api/src/main.ts",
  "apps/api/src/app.module.ts",
].map((target) => ({
  target,
  from: apiModulesDir,
  // Bootstrap may import the ordinary contract facade or the module-only
  // entrypoint that avoids eagerly evaluating a facade's pure exports.
  except: apiModules.flatMap((moduleName) => [
    `${moduleName}/index.ts`,
    `${moduleName}/module.ts`,
  ]),
  message:
    "api infrastructure and bootstrap files must consume module contracts through an owning public entrypoint",
}));

// One zone per web slice: files under features/S may import from features/ only
// within their own slice or through a sibling's public index.ts/client.ts entrypoint. ALL populated
// slices are enforced (boundaries flip #33); any slice-to-slice coupling not
// through a barrel is a lint error.
const webFeaturesDir = "apps/web/src/features";
const webSlices = [
  "admin",
  "analytics",
  "dashboard",
  "landing",
  "organization",
  "pdf-export",
  "period",
  "report-pages",
  "report-sections",
  "review",
  "slides",
  "telemetry",
  "viewer",
] as const;
const webCrossSliceZones = webSlices.map((sliceName) => ({
  target: `${webFeaturesDir}/${sliceName}`,
  from: webFeaturesDir,
  except: [
    sliceName,
    ...webSlices
      .filter((sibling) => sibling !== sliceName)
      .flatMap((sibling) => [`${sibling}/index.ts`, `${sibling}/client.ts`]),
  ],
  message: `web slice boundary: '${sliceName}' may reach a sibling slice only through its public index.ts or client.ts entrypoint (restructure-directory-architecture).`,
}));

export const boundaryConfig: Linter.Config[] = [
  // import boundary — apps/web must not import apps/api at RUNTIME. The tRPC
  // client legitimately needs the AppRouter *type* (apps/web/src/shared/lib/trpc/trpc.ts), so
  // type-only imports are allowed via allowTypeImports; a VALUE import would pull
  // the Nest/Prisma server graph into the browser bundle. Currently 0 violations.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@customreport/api", "@customreport/api/*"],
              allowTypeImports: true,
              message:
                "apps/web must not import apps/api at runtime; only `import type` is allowed (e.g. AppRouter for the tRPC client).",
            },
          ],
        },
      ],
    },
  },
  // ── restructure-directory-architecture slice 1: import-boundary zones. ──
  // Resolver so import-x/no-restricted-paths can map relative NodeNext specifiers
  // (`../period/period-transition.js` → the real .ts) to real paths; without it the
  // rule silently matches nothing and every zone becomes an inert no-op.
  {
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          noWarnOnMultipleProjects: true,
          project: [
            "apps/api/tsconfig.json",
            "apps/web/tsconfig.json",
            "packages/shared/tsconfig.json",
            "packages/ui/tsconfig.json",
          ],
        }),
      ],
    },
  },
  // Zone 3 — api cross-module internals. Tests are exempt: cross-module imports in
  // test setup are wiring, not production coupling (12 test files do it today).
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-restricted-paths": ["error", { zones: apiCrossModuleZones }],
    },
  },
  {
    files: [
      "apps/api/src/infrastructure/**/*.ts",
      "apps/api/src/main.ts",
      "apps/api/src/app.module.ts",
    ],
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        { zones: apiInfrastructureModuleZones },
      ],
    },
  },
  // Zone 5 — web cross-slice ban. Each extracted web slice appends its own zone
  // `{ target: features/<slice>, from: features, except: [<slice>] }` to
  // webCrossSliceZones — a shared allowlist cannot distinguish self-import from
  // cross-slice, so zones stay per-slice.
  {
    files: ["apps/web/src/features/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**"],
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-restricted-paths": ["error", { zones: webCrossSliceZones }],
    },
  },
  // Zone 4 — api domain purity (package-name zone). Files under an invariant
  // module's domain/ must not import an adapter dependency AT ALL — value OR
  // type — so the governing law of the module hexagon holds: delete Nest/Prisma
  // and the pure domain still compiles. A file that types against a Prisma
  // TransactionClient/entity slice is a transaction applicator (an application
  // use-case), not domain — it lives in application/ and receives the client
  // through a port.
  {
    files: [
      "apps/api/src/modules/period/domain/**/*.ts",
      "apps/api/src/modules/report-sections/domain/**/*.ts",
      "apps/api/src/modules/review/domain/**/*.ts",
      "apps/api/src/modules/publication/domain/**/*.ts",
      // admin is a flat (non-hexagon) module; its port + shared-type files
      // join the ban so the fixed ReportStatus leak cannot regress
      // (report-status-type). admin-shared.ts is now a barrel over the two —
      // all three stay listed so a re-inline cannot dodge the guard.
      "apps/api/src/modules/admin/admin-shared.ts",
      "apps/api/src/modules/admin/admin-repository.port.ts",
      "apps/api/src/modules/admin/admin-shared-types.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/client",
                "@nestjs/*",
                "ioredis",
                "bullmq",
                "nodemailer",
              ],
              message:
                "domain/ is pure: no @prisma/client, @nestjs/*, ioredis, bullmq or nodemailer (value OR type) — a Prisma-typed transaction applicator belongs in application/, receiving its client through a port (restructure-directory-architecture).",
            },
          ],
        },
      ],
    },
  },
  // Zone 4b — repository port-type boundary (repository-port-type-boundary
  // spec). The explicit inventory of port-declaring files: module
  // service/contract files whose interfaces domain code and routers consume.
  // They must not import @prisma/client — value OR type — so no port can leak
  // a Prisma type again (the admin-shared.ts leak fixed by report-status-type
  // is pinned by Zone 4 above). Unlike domain/, these files may use Nest —
  // only the Prisma boundary is banned. Sanctioned Prisma users stay OUTSIDE
  // this list: infrastructure/**, *.prisma-repository.ts adapters,
  // transaction applicators in application/, module query internals, and lib
  // helpers. A new port file joins this list in the change that creates it.
  {
    files: [
      "apps/api/src/modules/activity/activity.service.ts",
      "apps/api/src/modules/admin/action-log.service.ts",
      "apps/api/src/modules/admin/admin-repository.port.ts",
      "apps/api/src/modules/analytics/analytics.service.ts",
      "apps/api/src/modules/archive/archive.service.ts",
      "apps/api/src/modules/carry-over/carry-over.service.ts",
      "apps/api/src/modules/organization/organization.service.ts",
      "apps/api/src/modules/pdf-export/pdf-export.service.ts",
      "apps/api/src/modules/period/application/period.service.ts",
      "apps/api/src/modules/project-activity/project-activity.service.ts",
      "apps/api/src/modules/publication/application/publication.service.ts",
      "apps/api/src/modules/reminders/reminders.service.ts",
      "apps/api/src/modules/report-sections/application/report-sections.service.ts",
      "apps/api/src/modules/review/application/review-actions.service.ts",
      "apps/api/src/modules/review/application/review.service.ts",
      "apps/api/src/modules/search/search.service.ts",
      "apps/api/src/modules/telemetry/telemetry.gauges.ts",
      "apps/api/src/modules/telemetry/telemetry.service.ts",
      "apps/api/src/modules/weekly-report/weekly-report.service.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client"],
              message:
                "Port-contract files must not import @prisma/client (value OR type): return shared or locally owned read models — Prisma stays behind infrastructure adapters and sanctioned application/ applicators (repository-port-type-boundary).",
            },
          ],
        },
      ],
    },
  },
];
