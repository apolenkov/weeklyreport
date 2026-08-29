import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";

import { assertNonEmptyCoverageSummary } from "../coverage/coverage-evidence.ts";

const metric = (total: number) => ({ total, covered: total });
const fixtureRoot = mkdtempSync(join(tmpdir(), "coverage-evidence-"));
const apiRoot = join(fixtureRoot, "apps/api");
const webRoot = join(fixtureRoot, "apps/web");
const apiExample = join(apiRoot, "src/example.ts");
const apiModule = join(apiRoot, "src/modules/example.ts");
const webPage = join(webRoot, "src/app/page.tsx");
const escapedLink = join(apiRoot, "src/link.ts");

for (const path of [apiExample, apiModule, webPage]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "export {};\n");
}
symlinkSync(webPage, escapedLink);

after(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

void test("accepts a coverage summary with executed files and all metric denominators", () => {
  const evidence = assertNonEmptyCoverageSummary(
    {
      "src/example.ts": {},
      total: {
        lines: metric(3),
        statements: metric(3),
        functions: metric(1),
        branches: metric(2),
      },
    },
    "fixture/coverage-summary.json",
    "api",
    apiRoot,
  );
  assert.equal(evidence.fileCount, 1);
  assert.equal(evidence.totals.lines, 3);
});

void test("rejects an empty execution denominator even when the report is present", () => {
  assert.throws(
    () =>
      assertNonEmptyCoverageSummary(
        {
          "src/example.ts": {},
          total: {
            lines: metric(0),
            statements: metric(1),
            functions: metric(1),
            branches: metric(1),
          },
        },
        "fixture/coverage-summary.json",
        "api",
        apiRoot,
      ),
    /empty lines denominator/,
  );
});

void test("rejects metadata and stray paths as file evidence", () => {
  for (const strayKey of [
    "coverageMap",
    "package.json",
    "src/example.test.ts",
  ]) {
    assert.throws(
      () =>
        assertNonEmptyCoverageSummary(
          {
            [strayKey]: {},
            total: {
              lines: metric(3),
              statements: metric(3),
              functions: metric(1),
              branches: metric(2),
            },
          },
          "fixture/coverage-summary.json",
          "api",
          apiRoot,
        ),
      /metadata, stray, or excluded file key/,
    );
  }
});

void test("rejects a valid source path from the other package scope", () => {
  assert.throws(
    () =>
      assertNonEmptyCoverageSummary(
        {
          [webPage]: {},
          total: {
            lines: metric(3),
            statements: metric(3),
            functions: metric(1),
            branches: metric(2),
          },
        },
        "fixture/coverage-summary.json",
        "api",
        apiRoot,
      ),
    /metadata, stray, or excluded file key/,
  );
});

void test("rejects an absolute traversal path escaping the selected source scope", () => {
  assert.throws(
    () =>
      assertNonEmptyCoverageSummary(
        {
          [`${apiRoot}/src/../../web/src/app/page.tsx`]: {},
          total: {
            lines: metric(3),
            statements: metric(3),
            functions: metric(1),
            branches: metric(2),
          },
        },
        "fixture/coverage-summary.json",
        "api",
        apiRoot,
      ),
    /metadata, stray, or excluded file key/,
  );
});

void test("accepts an absolute path inside the selected source scope", () => {
  const evidence = assertNonEmptyCoverageSummary(
    {
      [apiModule]: {},
      total: {
        lines: metric(3),
        statements: metric(3),
        functions: metric(1),
        branches: metric(2),
      },
    },
    "fixture/coverage-summary.json",
    "api",
    apiRoot,
  );
  assert.equal(evidence.fileCount, 1);
});

void test("rejects a symlink whose canonical target escapes the source scope", () => {
  assert.throws(
    () =>
      assertNonEmptyCoverageSummary(
        {
          [escapedLink]: {},
          total: {
            lines: metric(3),
            statements: metric(3),
            functions: metric(1),
            branches: metric(2),
          },
        },
        "fixture/coverage-summary.json",
        "api",
        apiRoot,
      ),
    /metadata, stray, or excluded file key/,
  );
});

void test("rejects ambiguous relative paths when cwd belongs to another package", () => {
  assert.throws(
    () =>
      assertNonEmptyCoverageSummary(
        {
          "src/modules/example.ts": {},
          total: {
            lines: metric(3),
            statements: metric(3),
            functions: metric(1),
            branches: metric(2),
          },
        },
        "fixture/coverage-summary.json",
        "api",
        webRoot,
      ),
    /scope api does not match package root/,
  );
});
