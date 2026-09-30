import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { ESLint, type Linter } from "eslint";
import { expect, test } from "vitest";

test("ESLint permits existing function budgets and rejects new excess", async () => {
  const repository = resolve(import.meta.dirname, "../..");
  const eslint = new ESLint({ cwd: repository });
  const production = (await eslint.calculateConfigForFile(
    "apps/api/src/modules/reminders/reminders.service.ts",
  )) as Linter.Config | undefined;
  expect(production?.rules?.["max-lines-per-function"]).toBeDefined();
  expect(production?.rules?.["max-params"]).toBeDefined();

  for (const file of [
    "eslint-config/core.ts",
    "scripts/gates/eslint-suppressions.test.ts",
    "apps/api/src/test-utils/test-env.setup.ts",
  ]) {
    const config = (await eslint.calculateConfigForFile(file)) as
      Linter.Config | undefined;
    for (const ruleId of ["max-lines-per-function", "max-params"]) {
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
  const crowded = "function crowded(a,b,c,d,e,f) { return a; }\n";
  const boundary = `${longFunction(
    "boundary",
    80,
  )}function permitted(a,b,c,d,e) { return a; }\n`;
  const existing = boundary + longFunction("existing") + crowded;

  const lint = (expectedExit: number, flags: string[] = normalFlags) => {
    const result = spawnSync(
      process.execPath,
      [cli, ".", "--max-warnings", "0", "--format", "json", ...flags],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(expectedExit);
    const results = JSON.parse(result.stdout) as ESLint.LintResult[];
    return results.flatMap((result) =>
      result.messages.map(({ ruleId }) => ruleId),
    );
  };

  try {
    await writeFile(
      join(root, "eslint.config.mjs"),
      `export default [{ rules: ${JSON.stringify({
        "max-lines-per-function": production?.rules?.["max-lines-per-function"],
        "max-params": production?.rules?.["max-params"],
        "no-var": production?.rules?.["no-var"],
      })} }];`,
    );
    await writeFile(file, existing);
    expect(
      lint(0, [
        "--suppress-rule",
        "max-lines-per-function",
        "--suppress-rule",
        "max-params",
      ]),
    ).toEqual([]);
    const suppressions = await readFile(
      join(root, "eslint-suppressions.json"),
      "utf8",
    );
    expect(JSON.parse(suppressions)).toEqual({
      "existing.js": {
        "max-lines-per-function": { count: 1 },
        "max-params": { count: 1 },
      },
    });
    expect(lint(0)).toEqual([]);

    for (const { source, errors } of [
      {
        source: existing + longFunction("excess"),
        errors: ["max-lines-per-function", "max-lines-per-function"],
      },
      {
        source: `${existing}function excess(a,b,c,d,e,f) { return a; }\n`,
        errors: ["max-params", "max-params"],
      },
      { source: `${existing}var unrelated = 0;\n`, errors: ["no-var"] },
    ]) {
      await writeFile(file, source);
      expect(lint(1)).toEqual(errors);
    }
    await writeFile(file, boundary + crowded);
    expect(lint(0)).toEqual([]);
    expect(await readFile(join(root, "eslint-suppressions.json"), "utf8")).toBe(
      suppressions,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
