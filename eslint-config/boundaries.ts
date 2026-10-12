import type { Linter } from "eslint";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";

const apiModulesDir = "apps/api/src/modules";
export const apiModules = [
  "activity",
  "admin",
  "analytics",
  "archive",
  "auth",
  "carry-over",
  "email",
  "ai-prompts",
  "ai-provider",
  "observability",
  "organization",
  "pdf-export",
  "period",
  "product-feedback",
  "project-activity",
  "publication",
  "reminders",
  "report-sections",
  "review",
  "search",
  "telemetry",
  "weekly-report",
] as const;

// One zone per module: files under modules/M may import from modules/ ONLY within
// their own module (except: [M]), or through a sibling's index.ts facade barrel.
// Any other sibling internal path errors. The barrel allowlist is GENERATED
// (every sibling's index.ts), so a new module→module edge is legal the moment it
// targets the facade, keeping the boundary explicit for every module.
const apiCrossModuleZones = apiModules.map((moduleName) => ({
  target: `${apiModulesDir}/${moduleName}`,
  from: apiModulesDir,
  except: [
    moduleName,
    ...apiModules
      .filter((sibling) => sibling !== moduleName)
      .map((sibling) => `${sibling}/index.ts`),
  ],
  message: `api module boundary: '${moduleName}' may reach a sibling module only through its index.ts facade barrel, never an internal path (module-import-boundaries).`,
}));

const apiInfrastructureModuleZones = [
  "apps/api/src/infrastructure",
  "apps/api/src/lib",
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
// within their own slice or through a sibling's public index.ts/client.ts
// entrypoint; any slice-to-slice coupling not through a barrel is a lint error.
const webFeaturesDir = "apps/web/src/features";
export const webSlices = [
  "admin",
  "analytics",
  "dashboard",
  "landing",
  "organization",
  "pdf-export",
  "period",
  "product-feedback",
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
  message: `web slice boundary: '${sliceName}' may reach a sibling slice only through its public index.ts or client.ts entrypoint (module-import-boundaries).`,
}));

export const boundaryConfig: Linter.Config[] = [
  // import boundary — apps/web must not import apps/api at RUNTIME. The tRPC
  // client legitimately needs the AppRouter *type*, so
  // type-only imports are allowed via allowTypeImports; a VALUE import would pull
  // the Nest/Prisma server graph into the browser bundle.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "weeklyreport/web-api-runtime": [
        "error",
        {
          zones: [
            {
              target: "apps/web",
              from: "apps/api",
              message:
                "apps/web must not import apps/api at runtime; only erased type declarations are allowed (module-import-boundaries).",
            },
          ],
        },
      ],
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
  // ── module-import-boundaries slice 1: import-boundary zones. ──
  // Resolver so import-x/no-restricted-paths can map relative NodeNext specifiers
  // (`../period/period-transition.js` → the real .ts) to real paths; without it the
  // rule silently matches nothing and every zone becomes an inert no-op.
  {
    settings: {
      "import-x/extensions": [".ts", ".tsx"],
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
  // Zone 3 — api cross-module internals. Tests are exempt because their
  // cross-module imports are test wiring rather than production coupling.
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
      "apps/api/src/lib/**/*.ts",
      "apps/api/src/bootstrap/**/*.ts",
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
  // Slice barrels must stay acyclic; type-only edges erase at build time.
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/api/src/**/*.ts"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.ts", "**/__tests__/**"],
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-cycle": [
        "error",
        { allowUnsafeDynamicCyclicDependency: false },
      ],
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
      "apps/api/src/modules/**/domain/**/*.ts",
      // Admin is a flat module; its port and shared-type files stay in this
      // boundary so domain code cannot depend on admin infrastructure types.
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
                "domain/ is pure: no @prisma/client, @nestjs/*, ioredis, bullmq or nodemailer (value OR type) — a Prisma-typed transaction applicator belongs in application/, receiving its client through a port (module-import-boundaries).",
            },
          ],
        },
      ],
    },
  },
  // Zone 4b — repository port-type boundary. The explicit inventory of
  // port-declaring files covers module
  // service/contract files whose interfaces domain code and routers consume.
  // They must not import @prisma/client — value OR type — so no port can leak
  // a Prisma type. Unlike domain/, these files may use Nest —
  // only the Prisma boundary is banned. Sanctioned Prisma users stay OUTSIDE
  // this list: infrastructure/**, *.prisma-repository.ts adapters,
  // transaction applicators in application/, module query internals, and lib
  // helpers. New port files must be added to this inventory.
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
      "apps/api/src/modules/search/application/search.service.ts",
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
