import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const FIXTURE_PATH = resolve(
  REPOSITORY_ROOT,
  "apps/api/src/infrastructure/module-public-api-boundary.fixture.ts",
);
const PUBLIC_ENTRYPOINT = "../modules/admin/index.js";
const INTERNAL_MODULE_PATH = "../modules/admin/snapshot-admin.service.js";

function runEslint(source?: string): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = execFile(
      process.execPath,
      [
        resolve(REPOSITORY_ROOT, "node_modules/eslint/bin/eslint.js"),
        ...(source === undefined
          ? [FIXTURE_PATH]
          : ["--stdin", "--stdin-filename", FIXTURE_PATH]),
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
    readonly messages: readonly { readonly message: string }[];
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

// Each case runs ESLint over the tree in-process, ~10s idle. Twice that left no
// room once the web and shared suites run alongside it, and a boundary gate that
// fails on machine load is one people learn to re-run rather than read.
const ESLINT_RUN_BUDGET_MS = 60_000;

describe("API module public boundary", () => {
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
});
