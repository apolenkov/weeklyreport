import { execFile } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  apiModules,
  boundaryConfig,
  webSlices,
} from "../../../../eslint-config/boundaries.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const FIXTURE_PATH = resolve(
  REPOSITORY_ROOT,
  "apps/api/src/infrastructure/module-public-api-boundary.fixture.ts",
);
const MODULE_FIXTURE_PATH = resolve(
  REPOSITORY_ROOT,
  "apps/api/src/modules/weekly-report/weekly-report-portfolio.ts",
);
const PUBLIC_ENTRYPOINT = "../modules/admin/index.js";
const INTERNAL_MODULE_PATH = "../modules/admin/snapshot-admin.service.js";
const LIB_INTERNAL_MODULE_PATH = "../modules/admin/snapshot-admin.service.js";
const REPORT_SECTIONS_PUBLIC_ENTRYPOINT = "../report-sections/index.js";
const MODULE_BOUNDARY_SOURCE = `import type { buildAssembledReportFromPrismaRow } from "${REPORT_SECTIONS_PUBLIC_ENTRYPOINT}";

export type ModuleBoundaryFixture = typeof buildAssembledReportFromPrismaRow;
`;

const BOUNDARY_CASES = [
  {
    filename: resolve(
      REPOSITORY_ROOT,
      "apps/api/src/modules/product-feedback/index.ts",
    ),
    internal: "../report-sections/application/ensure-lead-section.js",
    facade: "../report-sections/index.js",
  },
  {
    filename: resolve(
      REPOSITORY_ROOT,
      "apps/web/src/features/product-feedback/index.ts",
    ),
    internal: "../report-sections/model/status-overview.js",
    facade: "../report-sections/index.js",
  },
  {
    filename: resolve(REPOSITORY_ROOT, "apps/api/src/bootstrap/api-ingress.ts"),
    internal: "../modules/report-sections/application/ensure-lead-section.js",
    facade: "../modules/report-sections/index.js",
  },
];

const DOMAIN_BOUNDARY_CASES = [
  {
    name: "ai-provider",
    filename: resolve(
      REPOSITORY_ROOT,
      "apps/api/src/modules/ai-provider/domain/provider-profile.ts",
    ),
    localImport: "./provider-identities.js",
  },
  {
    name: "search",
    filename: resolve(
      REPOSITORY_ROOT,
      "apps/api/src/modules/search/domain/candidate-filter.ts",
    ),
    localImport: "./entity-alias-index.js",
  },
] as const;

const UI_BOUNDARY_CASE = {
  name: "ui",
  filename: resolve(
    REPOSITORY_ROOT,
    "packages/ui/src/components/ui/button.tsx",
  ),
  localImport: "../../lib/utils.js",
} as const;

// Zone 4b lists port files by exact path, so the @prisma/client ban silently
// stops applying the moment a service moves. Resolve the file the search
// facade actually re-exports instead of restating the path here.
const SEARCH_FACADE_PATH = resolve(
  REPOSITORY_ROOT,
  "apps/api/src/modules/search/index.ts",
);
const SEARCH_SERVICE_SPECIFIER_PATTERN =
  /export\s*\{[^}]*\bSearchService\b[^}]*\}\s*from\s*"(?<specifier>\.[^"]+)"/;

interface LintMessage {
  readonly message: string;
  readonly ruleId: string | null;
}

interface BoundaryProbe {
  readonly key: string;
  readonly path: string;
  readonly source: string;
}

// Boundary zones are matched on physical paths and the configuration lints with
// type information, which requires the probe to exist, so every synthetic case
// is written next to the source it stands in for before ESLint runs.
const PROBE_PREFIX = "boundary-probe-";
const UNPLANNED_PROBE_SENTINEL_PATH = join(
  dirname(FIXTURE_PATH),
  `${PROBE_PREFIX}sentinel.ts`,
);
function probePath(targetPath: string, name: string): string {
  return join(dirname(targetPath), `${PROBE_PREFIX}${name}.ts`);
}

function removeStaleProbesSync(): void {
  for (const probe of probes) {
    rmSync(probe.path, { force: true });
  }
}

// SIGINT/SIGTERM/exit still remove the probes; only SIGKILL leaves them behind.
process.once("exit", removeStaleProbesSync);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    removeStaleProbesSync();
    process.exit(1);
  });
}

function runEslint(paths: readonly string[]): Promise<
  readonly {
    readonly filePath: string;
    readonly messages: readonly LintMessage[];
  }[]
> {
  return new Promise((resolveOutput, rejectOutput) => {
    execFile(
      process.execPath,
      [
        resolve(REPOSITORY_ROOT, "node_modules/eslint/bin/eslint.js"),
        ...paths,
        "--format",
        "json",
      ],
      { cwd: REPOSITORY_ROOT, encoding: "utf8" },
      (error, stdout) => {
        // A reported violation exits non-zero without invalidating the report,
        // so the JSON payload decides, exactly as the CLI gate does.
        if (stdout.length === 0) {
          rejectOutput(error ?? new Error("ESLint produced no output"));
          return;
        }
        resolveOutput(
          JSON.parse(stdout) as readonly {
            readonly filePath: string;
            readonly messages: readonly LintMessage[];
          }[],
        );
      },
    );
  });
}

// ESLint resolves --stdin-filename against the real flat config, so a virtual
// probe exercises the exact rule coverage of an on-disk path without
// rewriting the file it stands in for.
function runEslintStdin(
  filename: string,
  source: string,
): Promise<readonly LintMessage[]> {
  return new Promise((resolveOutput, rejectOutput) => {
    const child = execFile(
      process.execPath,
      [
        resolve(REPOSITORY_ROOT, "node_modules/eslint/bin/eslint.js"),
        "--stdin",
        "--stdin-filename",
        filename,
        "--format",
        "json",
      ],
      { cwd: REPOSITORY_ROOT, encoding: "utf8" },
      (error, stdout) => {
        if (stdout.length === 0) {
          rejectOutput(error ?? new Error("ESLint produced no output"));
          return;
        }
        const [result] = JSON.parse(stdout) as readonly {
          readonly messages: readonly LintMessage[];
        }[];
        if (!result) {
          rejectOutput(new Error("ESLint returned no result for stdin"));
          return;
        }
        resolveOutput(result.messages);
      },
    );
    child.stdin?.end(source);
  });
}

async function resolveSearchServicePath(): Promise<string> {
  const facadeSource = await readFile(SEARCH_FACADE_PATH, "utf8");
  const specifier =
    SEARCH_SERVICE_SPECIFIER_PATTERN.exec(facadeSource)?.groups?.specifier;
  if (!specifier) {
    throw new Error(
      "modules/search/index.ts no longer re-exports SearchService — reconcile the zone 4b port inventory",
    );
  }
  const servicePath = resolve(
    dirname(SEARCH_FACADE_PATH),
    specifier.replace(/\.js$/, ".ts"),
  );
  if (!existsSync(servicePath)) {
    throw new Error(`search service file missing on disk: ${servicePath}`);
  }
  return servicePath;
}

let probes: readonly BoundaryProbe[] = [];
const messagesByKey = new Map<string, readonly LintMessage[]>();

// Rewriting the probe set is enough for ESLint to re-read every case, and the
// suite keeps a generous timeout so a loaded machine reports boundary defects
// instead of timing out — the shared CLI run happens in the hook, so the hook
// needs the same budget as the cases.
const ESLINT_RUN_BUDGET_MS = 240_000;

// One ESLint process for the whole gate: each synthetic case used to pay its
// own TypeScript program build, which alone exceeded the per-command budget.
// Every case still lints the real configuration through the real CLI.
beforeAll(async () => {
  const publicSource = await readFile(FIXTURE_PATH, "utf8");
  probes = [
    {
      key: "internal-import",
      path: probePath(FIXTURE_PATH, "internal-import"),
      source: publicSource.replace(PUBLIC_ENTRYPOINT, INTERNAL_MODULE_PATH),
    },
    {
      key: "facade-import",
      path: probePath(MODULE_FIXTURE_PATH, "facade-import"),
      source: MODULE_BOUNDARY_SOURCE,
    },
    ...BOUNDARY_CASES.flatMap((boundaryCase, index) => [
      {
        key: `${index}:internal`,
        path: probePath(boundaryCase.filename, `${index}-internal`),
        source: `import "${boundaryCase.internal}";\n`,
      },
      {
        key: `${index}:facade`,
        path: probePath(boundaryCase.filename, `${index}-facade`),
        source: `import "${boundaryCase.facade}";\n`,
      },
    ]),
    ...(
      [
        ["relative-value", 'import "../../../../../api/src/app.module.js";\n'],
        [
          "relative-type",
          'import type { AppRouter } from "../../../../../api/src/infrastructure/trpc/trpc.router.js";\nexport type Probe = AppRouter;\n',
        ],
        [
          "inline-type",
          'import { type AppRouter } from "../../../../../api/src/infrastructure/trpc/trpc.router.js";\nexport type Probe = AppRouter;\n',
        ],
        [
          "mixed-value",
          'import { createAppRouter, type AppRouter } from "../../../../../api/src/infrastructure/trpc/trpc.router.js";\nexport type Probe = AppRouter;\nexport { createAppRouter };\n',
        ],
        [
          "export-type",
          'export type { AppRouter } from "../../../../../api/src/infrastructure/trpc/trpc.router.js";\n',
        ],
        [
          "export-value",
          'export { createAppRouter } from "../../../../../api/src/infrastructure/trpc/trpc.router.js";\n',
        ],
        [
          "package-type",
          'import type { AppRouter } from "@weeklyreport/api";\nexport type Probe = AppRouter;\n',
        ],
        [
          "source-disable",
          '/* eslint-disable weeklyreport/web-api-runtime */\nimport "../../../../../api/src/app.module.js";\n',
        ],
        ["package-value", 'import "@weeklyreport/api";\n'],
        [
          "dynamic-value",
          'void import("../../../../../api/src/app.module.js");\n',
        ],
        ["require-value", 'require("../../../../../api/src/app.module.js");\n'],
        [
          "inline-export-type",
          'export { type AppRouter } from "../../../../../api/src/infrastructure/trpc/trpc.router.js";\n',
        ],
        ["web-local", 'import "../../../app/api/revalidate-org/route.js";\n'],
      ] as const
    ).map(([key, source]) => ({
      key: `web-api:${key}`,
      path: probePath(
        resolve(
          REPOSITORY_ROOT,
          "apps/web/src/shared/lib/trpc/trpc-context.tsx",
        ),
        `web-api-${key}`,
      ),
      source,
    })),
    ...DOMAIN_BOUNDARY_CASES.flatMap((boundaryCase) => [
      {
        key: `${boundaryCase.name}:forbidden`,
        path: probePath(
          boundaryCase.filename,
          `${boundaryCase.name}-domain-forbidden`,
        ),
        source: 'import "@nestjs/common";\n',
      },
      {
        key: `${boundaryCase.name}:local`,
        path: probePath(
          boundaryCase.filename,
          `${boundaryCase.name}-domain-local`,
        ),
        source: `import "${boundaryCase.localImport}";\n`,
      },
    ]),
    {
      key: `${UI_BOUNDARY_CASE.name}:forbidden`,
      path: probePath(UI_BOUNDARY_CASE.filename, "ui-forbidden"),
      source: 'import "@weeklyreport/shared";\n',
    },
    {
      key: `${UI_BOUNDARY_CASE.name}:local`,
      path: probePath(UI_BOUNDARY_CASE.filename, "ui-local"),
      source: `import "${UI_BOUNDARY_CASE.localImport}";\n`,
    },
  ];
  await writeFile(
    UNPLANNED_PROBE_SENTINEL_PATH,
    "// test-owned cleanup sentinel\n",
    "utf8",
  );
  removeStaleProbesSync();
  await Promise.all(
    probes.map((probe) => writeFile(probe.path, probe.source, "utf8")),
  );
  const results = await runEslint([
    FIXTURE_PATH,
    ...probes.map((probe) => probe.path),
  ]);
  const byPath = new Map(
    results.map((result) => [result.filePath, result.messages]),
  );
  for (const [key, path] of [
    ["fixture", FIXTURE_PATH],
    ...probes.map((probe) => [probe.key, probe.path] as const),
  ] as const) {
    const messages = byPath.get(path);
    if (!messages) throw new Error(`ESLint returned no results for ${key}`);
    messagesByKey.set(key, messages);
  }
}, ESLINT_RUN_BUDGET_MS);

afterAll(async () => {
  await Promise.all([
    ...probes.map((probe) => rm(probe.path, { force: true })),
    rm(UNPLANNED_PROBE_SENTINEL_PATH, { force: true }),
  ]);
  removeStaleProbesSync();
});

function messagesFor(key: string): readonly LintMessage[] {
  const messages = messagesByKey.get(key);
  if (!messages) throw new Error(`no lint result recorded for ${key}`);
  return messages;
}

describe("API module public boundary", () => {
  it("preserves prefix-named files outside planned probe paths", () => {
    expect(existsSync(UNPLANNED_PROBE_SENTINEL_PATH)).toBe(true);
  });

  it("covers every API module, web slice, and bootstrap source", async () => {
    const directoryNames = async (path: string) =>
      (await readdir(resolve(REPOSITORY_ROOT, path), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

    await expect(directoryNames("apps/api/src/modules")).resolves.toEqual(
      [...apiModules].sort(),
    );
    await expect(directoryNames("apps/web/src/features")).resolves.toEqual(
      [...webSlices].sort(),
    );
    expect(
      boundaryConfig.some(
        (config) =>
          Array.isArray(config.files) &&
          config.files.includes("apps/api/src/bootstrap/**/*.ts"),
      ),
    ).toBe(true);
  });

  it(
    "allows infrastructure to import a module public barrel",
    () => {
      expect(messagesFor("fixture")).toEqual([]);
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "rejects infrastructure imports of module internals",
    () => {
      expect(messagesFor("internal-import")).toEqual([
        expect.objectContaining({
          ruleId: "import-x/no-restricted-paths",
          message: expect.stringContaining(
            "through an owning public entrypoint",
          ) as unknown as string,
        }),
      ]);
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "allows report-sections facade imports",
    () => {
      expect(messagesFor("facade-import")).toEqual([]);
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "enforces product-feedback and bootstrap boundaries through public facades",
    () => {
      for (const index of BOUNDARY_CASES.keys()) {
        expect(messagesFor(`${index}:internal`)).toEqual([
          expect.objectContaining({
            ruleId: "import-x/no-restricted-paths",
          }),
        ]);
        expect(messagesFor(`${index}:facade`)).toEqual([]);
      }
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "enforces API domain purity and the shared UI package boundary",
    () => {
      for (const boundaryCase of DOMAIN_BOUNDARY_CASES) {
        expect(messagesFor(`${boundaryCase.name}:forbidden`)).toEqual([
          expect.objectContaining({
            ruleId: "@typescript-eslint/no-restricted-imports",
            message: expect.stringContaining(
              "domain/ is pure",
            ) as unknown as string,
          }),
        ]);
        expect(messagesFor(`${boundaryCase.name}:local`)).toEqual([]);
      }
      expect(messagesFor(`${UI_BOUNDARY_CASE.name}:forbidden`)).toEqual([
        expect.objectContaining({
          ruleId: "@typescript-eslint/no-restricted-imports",
          message: expect.stringContaining(
            "packages/ui must stay domain-free",
          ) as unknown as string,
        }),
      ]);
      expect(messagesFor(`${UI_BOUNDARY_CASE.name}:local`)).toEqual([]);
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "keeps the @prisma/client ban on the physical search service file",
    async () => {
      const messages = await runEslintStdin(
        await resolveSearchServicePath(),
        'import "@prisma/client";\n',
      );
      expect(messages).toEqual([
        expect.objectContaining({
          ruleId: "@typescript-eslint/no-restricted-imports",
          message: expect.stringContaining(
            "repository-port-type-boundary",
          ) as unknown as string,
        }),
      ]);
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "keeps apps/api/src/lib on module barrels only",
    async () => {
      const filename = resolve(
        REPOSITORY_ROOT,
        "apps/api/src/lib/human-session.ts",
      );
      const internal = await runEslintStdin(
        filename,
        `import "${LIB_INTERNAL_MODULE_PATH}";\n`,
      );
      expect(internal).toEqual([
        expect.objectContaining({ ruleId: "import-x/no-restricted-paths" }),
      ]);
      const barrel = await runEslintStdin(
        filename,
        'import "../modules/admin/index.js";\n',
      );
      expect(barrel).toEqual([]);
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "rejects runtime import cycles in the API and the web app",
    async () => {
      for (const [file, backImport] of [
        ["apps/api/src/modules/search/index.ts", "../publication/index.js"],
        [
          "apps/web/src/features/report-sections/index.ts",
          "../slides/index.js",
        ],
      ] as const) {
        const messages = await runEslintStdin(
          resolve(REPOSITORY_ROOT, file),
          `import * as probe from "${backImport}";\nexport { probe };\n`,
        );
        expect(messages).toEqual([
          expect.objectContaining({ ruleId: "import-x/no-cycle" }),
        ]);
      }
    },
    ESLINT_RUN_BUDGET_MS,
  );
});

describe("web runtime API boundary", () => {
  it("rejects resolved runtime API edges and preserves type-only/local boundaries", () => {
    for (const key of [
      "relative-value",
      "mixed-value",
      "export-value",
      "dynamic-value",
      "require-value",
    ]) {
      expect(
        messagesFor(`web-api:${key}`).some(
          (message) => message.ruleId === "weeklyreport/web-api-runtime",
        ),
      ).toBe(true);
    }
    expect(
      messagesFor("web-api:package-value").some(
        (message) =>
          message.ruleId === "@typescript-eslint/no-restricted-imports",
      ),
    ).toBe(true);
    expect(
      messagesFor("web-api:source-disable").some(
        (message) =>
          message.ruleId ===
          "@eslint-community/eslint-comments/no-restricted-disable",
      ),
    ).toBe(true);
    for (const key of [
      "relative-type",
      "package-type",
      "inline-type",
      "export-type",
      "inline-export-type",
      "web-local",
    ]) {
      expect(
        messagesFor(`web-api:${key}`).filter(
          (message) =>
            message.ruleId === "weeklyreport/web-api-runtime" ||
            message.ruleId === "@typescript-eslint/no-restricted-imports",
        ),
      ).toEqual([]);
    }
  });
});
