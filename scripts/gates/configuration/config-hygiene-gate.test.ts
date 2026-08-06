import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ARCHAEOLOGY =
  /(?:tasks[.]md|HEAD-CONSOLIDATE|Phase\s+\d|fix-report-surface-integrity|\(task\s+\d)/u;

const hygieneFindings = (source: string): readonly string[] =>
  source
    .split("\n")
    .flatMap((line, index) =>
      ARCHAEOLOGY.test(line) ? [`${index + 1}: ${line}`] : [],
    );

void test("planted config archaeology is rejected", () => {
  assert.deepEqual(hygieneFindings("note: Phase 2 rollout\nok"), [
    "1: note: Phase 2 rollout",
  ]);
});

void test("active catalog and environment examples contain no archaeology", () => {
  const catalogDirectory = path.resolve("e2e/catalog");
  const files = [
    ...readdirSync(catalogDirectory)
      .filter((file) => /[.](?:md|yaml)$/u.test(file))
      .map((file) => path.join(catalogDirectory, file)),
    path.resolve(".env.example"),
  ];
  const findings = files.flatMap((file) =>
    hygieneFindings(readFileSync(file, "utf8")).map(
      (finding) => `${path.relative(process.cwd(), file)}:${finding}`,
    ),
  );
  assert.deepEqual(findings, []);
});

void test("environment example references current maintained paths and version", () => {
  const source = readFileSync(".env.example", "utf8");
  const packageVersion: unknown = JSON.parse(
    readFileSync("package.json", "utf8"),
  );
  assert.equal(
    typeof packageVersion === "object" &&
      packageVersion !== null &&
      "version" in packageVersion &&
      typeof packageVersion.version === "string",
    true,
  );
  assert.match(source, /e2e\/playwright[.]integration[.]config[.]ts/u);
  assert.match(
    source,
    /apps\/web\/src\/shared\/ui\/auth-runtime\/role-switcher[.]tsx/u,
  );
  assert.doesNotMatch(
    source,
    /apps\/web\/playwright[.]integration[.]config[.]ts/u,
  );
  assert.doesNotMatch(
    source,
    /apps\/web\/src\/components\/dev\/role-switcher[.]tsx/u,
  );
  if (
    typeof packageVersion === "object" &&
    packageVersion !== null &&
    "version" in packageVersion &&
    typeof packageVersion.version === "string"
  ) {
    assert.match(
      source,
      new RegExp(`OTEL_SERVICE_VERSION=${packageVersion.version}`, "u"),
    );
  }
});
