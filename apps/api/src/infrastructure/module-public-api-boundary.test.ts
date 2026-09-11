import { execFile } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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
const REPORT_SECTIONS_PUBLIC_ENTRYPOINT = "../report-sections/index.js";
const MODULE_BOUNDARY_SOURCE = `import type { buildAssembledReportFromPrismaRow } from "${REPORT_SECTIONS_PUBLIC_ENTRYPOINT}";

export type ModuleBoundaryFixture = typeof buildAssembledReportFromPrismaRow;
`;

function runEslint(source?: string, filename = FIXTURE_PATH): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = execFile(
      process.execPath,
      [
        resolve(REPOSITORY_ROOT, "node_modules/eslint/bin/eslint.js"),
        ...(source === undefined
          ? [filename]
          : ["--stdin", "--stdin-filename", filename]),
        "--format",
        "json",
      ],
      { cwd: REPOSITORY_ROOT, encoding: "utf8" },
      (error, stdout) => {
        if (stdout.length > 0) {
          resolveOutput(stdout);
          return;
        }
        reject(error ?? new Error("ESLint produced no output"));
      },
    );
    if (source !== undefined) {
      child.stdin?.end(source);
    }
  });
}

function parseMessages(output: string) {
  const [result] = JSON.parse(output) as {
    readonly messages: readonly {
      readonly message: string;
      readonly ruleId: string | null;
    }[];
  }[];
  if (!result) throw new Error("ESLint returned no file results");
  return result.messages;
}

async function lintTemporaryInternalImport() {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "customreport-boundary-"),
  );
  const temporaryFixture = join(temporaryDirectory, basename(FIXTURE_PATH));
  try {
    await copyFile(FIXTURE_PATH, temporaryFixture);
    const publicSource = await readFile(temporaryFixture, "utf8");
    await writeFile(
      temporaryFixture,
      publicSource.replace(PUBLIC_ENTRYPOINT, INTERNAL_MODULE_PATH),
      "utf8",
    );
    return parseMessages(
      await runEslint(await readFile(temporaryFixture, "utf8")),
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

// Each case runs one or two ESLint processes over the tree. Leave enough room
// for the complete monorepo suite to run alongside them: a boundary gate that
// fails on machine load is one people learn to re-run rather than read.
const ESLINT_RUN_BUDGET_MS = 240_000;

describe("API module public boundary", () => {
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
    async () => {
      const messages = parseMessages(await runEslint());

      expect(messages).toEqual([]);
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "rejects infrastructure imports of module internals",
    async () => {
      const messages = await lintTemporaryInternalImport();

      expect(messages).toEqual([
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
    async () => {
      const publicMessages = parseMessages(
        await runEslint(MODULE_BOUNDARY_SOURCE, MODULE_FIXTURE_PATH),
      );
      expect(publicMessages).toEqual([]);
    },
    ESLINT_RUN_BUDGET_MS,
  );

  it(
    "enforces product-feedback and bootstrap boundaries through public facades",
    async () => {
      const cases = [
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
          filename: resolve(
            REPOSITORY_ROOT,
            "apps/api/src/bootstrap/api-ingress.ts",
          ),
          internal:
            "../modules/report-sections/application/ensure-lead-section.js",
          facade: "../modules/report-sections/index.js",
        },
      ];

      for (const boundaryCase of cases) {
        const internalMessages = parseMessages(
          await runEslint(
            `import "${boundaryCase.internal}";\n`,
            boundaryCase.filename,
          ),
        );
        expect(internalMessages).toEqual([
          expect.objectContaining({
            ruleId: "import-x/no-restricted-paths",
          }),
        ]);
        expect(
          parseMessages(
            await runEslint(
              `import "${boundaryCase.facade}";\n`,
              boundaryCase.filename,
            ),
          ),
        ).toEqual([]);
      }
    },
    ESLINT_RUN_BUDGET_MS,
  );
});
