import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const FIXTURE_PATH = resolve(
  REPOSITORY_ROOT,
  "apps/api/src/infrastructure/module-public-api-boundary.fixture.ts",
);
const PUBLIC_IMPORT =
  'import type { AdminService } from "../modules/admin/index.js";\n\nexport type PublicBoundaryFixture = AdminService;\n';

function runEslint(): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile(
      process.execPath,
      [
        resolve(REPOSITORY_ROOT, "node_modules/eslint/bin/eslint.js"),
        FIXTURE_PATH,
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
  });
}

async function lintInfrastructureImport(source: string) {
  await writeFile(FIXTURE_PATH, source, "utf8");
  try {
    const [result] = JSON.parse(await runEslint()) as {
      readonly messages: readonly { readonly message: string }[];
    }[];
    return result.messages;
  } finally {
    await writeFile(FIXTURE_PATH, PUBLIC_IMPORT, "utf8");
  }
}

describe("API module public boundary", () => {
  it("allows infrastructure to import a module public barrel", async () => {
    const messages = await lintInfrastructureImport(PUBLIC_IMPORT);

    expect(messages).toEqual([]);
  }, 20_000);

  it("rejects infrastructure imports of module internals", async () => {
    const messages = await lintInfrastructureImport(
      'import type { AdminService } from "../modules/admin/admin.service.js";\n\nexport type PublicBoundaryFixture = AdminService;\n',
    );

    expect(messages).toEqual([
      expect.objectContaining({
        ruleId: "import-x/no-restricted-paths",
        message: expect.stringContaining("index.ts public API") as unknown,
      }),
    ]);
  }, 20_000);
});
