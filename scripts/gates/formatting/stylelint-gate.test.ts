import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

function pnpmCommand(): readonly [string, readonly string[]] {
  const executable = process.env.npm_execpath;
  assert.ok(executable, "npm_execpath must identify the repository pnpm");
  return /\.[cm]?js$/.test(executable)
    ? [process.execPath, [executable]]
    : [executable, []];
}

void test("Stylelint exits nonzero when a configured warning fires", () => {
  const directory = mkdtempSync(join(tmpdir(), "stylelint-gate-"));
  const fixture = join(directory, "warning.css");
  writeFileSync(fixture, ".probe { color: red !important; }\n");
  const [command, prefix] = pnpmCommand();
  const result = spawnSync(
    command,
    [
      ...prefix,
      "exec",
      "stylelint",
      "--config",
      resolve(".stylelintrc.json"),
      "--max-warnings",
      "0",
      fixture,
    ],
    { encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /declaration-no-important/);
});

void test("Stylelint excludes generated test-result CSS", () => {
  const fixture = resolve("test-results/stylelint-scope-probe/trace.css");
  const [command, prefix] = pnpmCommand();
  try {
    mkdirSync(dirname(fixture), { recursive: true });
    writeFileSync(fixture, ".probe { color: red !important; }\n");
    const result = spawnSync(
      command,
      [
        ...prefix,
        "exec",
        "stylelint",
        fixture,
        "--allow-empty-input",
        "--max-warnings",
        "0",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  } finally {
    rmSync(dirname(fixture), { recursive: true, force: true });
  }
});
