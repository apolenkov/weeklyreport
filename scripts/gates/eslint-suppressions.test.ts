import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

import { maxParamsRule } from "../../eslint-config/max-params.ts";

const maxParamsRuleId = "weeklyreport/max-params";

test("ESLint rejects new excess and requires pruning fixed budgets", async () => {
  const repository = resolve(import.meta.dirname, "../..");
  const eslint = new ESLint({ cwd: repository });
  const production = (await eslint.calculateConfigForFile(
    "apps/api/src/modules/reminders/reminders.service.ts",
  )) as Linter.Config | undefined;
  expect(production?.rules?.["max-lines-per-function"]).toEqual([
    2,
    { max: 80, skipBlankLines: true, skipComments: true },
  ]);
  expect(production?.rules?.[maxParamsRuleId]).toEqual([2, 4]);
  expect(production?.rules?.["max-depth"]).toEqual([2, 3]);
  const nativeRule = production?.rules?.["max-params"];
  expect(Array.isArray(nativeRule) ? nativeRule[0] : nativeRule).toBe(0);

  for (const file of [
    "eslint-config/core.ts",
    "scripts/gates/eslint-suppressions.test.ts",
    "apps/api/src/test-utils/test-env.setup.ts",
  ]) {
    const config = (await eslint.calculateConfigForFile(file)) as
      Linter.Config | undefined;
    for (const ruleId of [
      "max-lines-per-function",
      "max-params",
      maxParamsRuleId,
    ]) {
      const rule = config?.rules?.[ruleId];
      expect(Array.isArray(rule) ? rule[0] : rule).toBe(0);
    }
  }

  const manifest = JSON.parse(
    await readFile(join(repository, "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  const normalFlags = manifest.scripts["lint:eslint"]?.includes(
    "--pass-on-unpruned-suppressions",
  )
    ? ["--pass-on-unpruned-suppressions"]
    : [];
  const require = createRequire(import.meta.url);
  const cli = join(
    dirname(require.resolve("eslint/package.json")),
    "bin/eslint.js",
  );
  const root = await mkdtemp(
    join(tmpdir(), "weeklyreport-eslint-suppressions-"),
  );
  const file = join(root, "existing.js");
  const longFunction = (name: string, lines = 81) =>
    `function ${name}() {\n${"void 0;\n".repeat(lines - 2)}}\n`;
  const crowded = "function crowded(a,b,c,d,e) { return a; }\n";
  const boundary = `${longFunction(
    "boundary",
    80,
  )}function permitted(a,b,c,d) { return a; }\n`;
  const existing = boundary + longFunction("existing") + crowded;

  const lint = (expectedExit: number, flags: string[] = normalFlags) => {
    const result = spawnSync(
      process.execPath,
      [cli, ".", "--max-warnings", "0", "--format", "json", ...flags],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(expectedExit);
    if (expectedExit === 2) {
      expect(result.stderr).toContain("--prune-suppressions");
    }
    const results = JSON.parse(result.stdout) as ESLint.LintResult[];
    return results.flatMap((result) =>
      result.messages.map(({ ruleId }) => ruleId),
    );
  };

  try {
    await writeFile(
      join(root, "eslint.config.mjs"),
      `import { maxParamsRule } from ${JSON.stringify(
        pathToFileURL(join(repository, "eslint-config/max-params.ts")).href,
      )};
export default [{
  plugins: { weeklyreport: { rules: { "max-params": maxParamsRule } } },
  rules: ${JSON.stringify({
    "max-lines-per-function": production?.rules?.["max-lines-per-function"],
    [maxParamsRuleId]: production?.rules?.[maxParamsRuleId],
    "no-var": production?.rules?.["no-var"],
  })} }];`,
    );
    await writeFile(file, existing);
    expect(
      lint(0, [
        "--suppress-rule",
        "max-lines-per-function",
        "--suppress-rule",
        maxParamsRuleId,
      ]),
    ).toEqual([]);
    const suppressions = await readFile(
      join(root, "eslint-suppressions.json"),
      "utf8",
    );
    expect(JSON.parse(suppressions)).toEqual({
      "existing.js": {
        "max-lines-per-function": { count: 1 },
        [maxParamsRuleId]: { count: 1 },
      },
    });
    expect(lint(0)).toEqual([]);

    for (const { source, errors } of [
      {
        source: existing + longFunction("excess"),
        errors: ["max-lines-per-function", "max-lines-per-function"],
      },
      {
        source: `${existing}function excess(a,b,c,d,e) { return a; }\n`,
        errors: [maxParamsRuleId, maxParamsRuleId],
      },
      { source: `${existing}var unrelated = 0;\n`, errors: ["no-var"] },
    ]) {
      await writeFile(file, source);
      expect(lint(1)).toEqual(errors);
    }
    await writeFile(file, boundary + crowded);
    for (const baseline of [
      suppressions,
      JSON.stringify({ "existing.js": { [maxParamsRuleId]: { count: 2 } } }),
    ]) {
      await writeFile(join(root, "eslint-suppressions.json"), baseline);
      expect(lint(2)).toEqual([]);
      expect(
        await readFile(join(root, "eslint-suppressions.json"), "utf8"),
      ).toBe(baseline);
      expect(lint(0, ["--prune-suppressions"])).toEqual([]);
      expect(
        JSON.parse(
          await readFile(join(root, "eslint-suppressions.json"), "utf8"),
        ),
      ).toEqual({ "existing.js": { [maxParamsRuleId]: { count: 1 } } });
      expect(lint(0)).toEqual([]);
    }
    expect(normalFlags).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("max-params preserves native boundaries and exempts only imported Nest DI", () => {
  const linter = new Linter();
  const lint = (source: string, ruleId: string) =>
    linter.verify(
      source,
      {
        files: ["**/*.ts"],
        languageOptions: { parser: tseslint.parser },
        plugins: { weeklyreport: { rules: { "max-params": maxParamsRule } } },
        rules: { [ruleId]: ["error", 4] },
      },
      { filename: "boundary.ts" },
    );
  const constructor = "constructor(a,b,c,d,e) {}";
  const typed = "a: unknown, b: unknown, c: unknown, d: unknown, e: unknown";
  const cases = [
    { source: "function allowed(a,b,c,d) {}", expected: 0, native: 0 },
    { source: "function crowded(a,b,c,d,e) {}", expected: 1, native: 1 },
    { source: "const crowded = (a,b,c,d,e) => a;", expected: 1, native: 1 },
    {
      source: "const crowded = function(a,b,c,d,e) {};",
      expected: 1,
      native: 1,
    },
    {
      source: `type SharedCallback = (${typed}) => void;`,
      expected: 1,
      native: 1,
    },
    {
      source: `declare function crowded(${typed}): void;`,
      expected: 1,
      native: 1,
    },
    { source: `class Plain { ${constructor} }`, expected: 1, native: 1 },
    ...["Injectable", "Controller", "Catch", "Module"].map((marker) => ({
      source: `import { ${marker} } from "@nestjs/common";
@${marker}() class Provider { ${constructor} }`,
      expected: 0,
      native: 1,
    })),
    {
      source: `import { Injectable as Service } from "@nestjs/common";
@Service() class Provider { ${constructor} crowded(a,b,c,d,e) {} }`,
      expected: 1,
      native: 2,
    },
    {
      source: `import * as Nest from "@nestjs/common";
@Nest.Injectable() class Provider { ${constructor} }`,
      expected: 0,
      native: 1,
    },
    {
      source: `import * as Nest from "@nestjs/common";
@(Nest["Injectable"]()) class Provider { ${constructor} }`,
      expected: 0,
      native: 1,
    },
    {
      source: `import * as Nest from "@nestjs/common";
const marker = "Injectable";
@(Nest[marker]()) class Provider { ${constructor} }`,
      expected: 1,
      native: 1,
    },
    ...["Inject", "Optional"].map((marker) => ({
      source: `import { ${marker} as Parameter } from "@nestjs/common";
class Provider { constructor(@Parameter() private readonly a: unknown,b,c,d,e) {} }`,
      expected: 0,
      native: 1,
    })),
    {
      source: `import * as Nest from "@nestjs/common";
class Provider { constructor(@Nest.Inject("token") a,b,c,d,e) {} }`,
      expected: 0,
      native: 1,
    },
    {
      source: `import { Inject } from "@nestjs/common";
class Provider { constructor(@Inject("token") Inject,b,c,d,e) {} }`,
      expected: 0,
      native: 1,
    },
    {
      source: `function Injectable() {}
@Injectable() class Fake { ${constructor} }`,
      expected: 1,
      native: 1,
    },
    {
      source: `import { Injectable } from "other-package";
@Injectable() class Fake { ${constructor} }`,
      expected: 1,
      native: 1,
    },
    {
      source: `import { Injectable as Service } from "@nestjs/common";
function create(Service: unknown) { @Service() class Fake { ${constructor} } }`,
      expected: 1,
      native: 1,
    },
    {
      source: `import * as Nest from "@nestjs/common";
function create(Nest: unknown) { @Nest.Injectable() class Fake { ${constructor} } }`,
      expected: 1,
      native: 1,
    },
    {
      source: `import type { Injectable } from "@nestjs/common";
@Injectable() class Fake { ${constructor} }`,
      expected: 1,
      native: 1,
    },
    {
      source: `import { type Injectable } from "@nestjs/common";
@Injectable() class Fake { ${constructor} }`,
      expected: 1,
      native: 1,
    },
    {
      source: `import { Inject } from "@nestjs/common";
@Inject() class Fake { ${constructor} }`,
      expected: 1,
      native: 1,
    },
    {
      source: `import { Injectable } from "@nestjs/common";
class Fake { constructor(@Injectable() a,b,c,d,e) {} }`,
      expected: 1,
      native: 1,
    },
    {
      source: `import { Module } from "@nestjs/common";
@Module({ providers: [{ useFactory: (a,b,c,d,e) => a }] }) class Provider {}`,
      expected: 1,
      native: 1,
    },
    {
      source: "function allowed(this: void,a,b,c,d) {}",
      expected: 0,
      native: 0,
    },
    {
      source: "function crowded(this: unknown,a,b,c,d) {}",
      expected: 1,
      native: 1,
    },
    {
      source: "type Allowed = (this: void,a,b,c,d) => void;",
      expected: 0,
      native: 0,
    },
    {
      source: "declare function crowded(this: unknown,a,b,c,d): void;",
      expected: 1,
      native: 1,
    },
  ];
  for (const { source, expected, native } of cases) {
    const actual = lint(source, maxParamsRuleId);
    const reference = lint(source, "max-params");
    expect(actual, source).toHaveLength(expected);
    expect(reference, source).toHaveLength(native);
    for (const message of [...actual, ...reference]) {
      expect(message.fatal, source).not.toBe(true);
      expect(message.messageId, source).toBe("exceed");
    }
  }
});
