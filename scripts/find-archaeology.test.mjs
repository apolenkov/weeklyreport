import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const scriptPath = fileURLToPath(
  new URL("./find-archaeology.mjs", import.meta.url),
);

const scan = (fixtures) => {
  const dir = mkdtempSync(join(tmpdir(), "archaeology-gate-"));
  const paths = Object.entries(fixtures).map(([name, content]) => {
    const fixturePath = join(dir, name);
    mkdirSync(join(fixturePath, ".."), { recursive: true });
    writeFileSync(fixturePath, content);
    return fixturePath;
  });

  return spawnSync(process.execPath, [scriptPath, ...paths], {
    cwd: dir,
    encoding: "utf8",
  });
};

test("flags a real archaeology comment", () => {
  const result = scan({
    "real.ts": "// AUTH-08 moved this implementation into the service.\n",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /real\.ts/);
  assert.match(result.stdout, /ticket-slug/);
  assert.match(result.stdout, /1 archaeology hit\(s\) in 1 file\(s\)/);
});

test("ignores a quoted ticket-slug example inside a source string", () => {
  const result = scan({
    "quoted.ts": 'const example = "// AUTH-08";\n',
  });

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /0 archaeology hit\(s\) in 0 file\(s\)/);
});

test("accepts a clean current-behavior comment", () => {
  const result = scan({
    "clean.ts": "// This guard keeps published reports immutable.\n",
  });

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /0 archaeology hit\(s\) in 0 file\(s\)/);
});

test("does not flag standards tokens that merely look like ticket slugs", () => {
  const result = scan({
    "standards.ts":
      "// Emails validate against RFC-5322; timestamps are ISO-8601;\n// digests use SHA-256.\n",
  });

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /0 archaeology hit\(s\) in 0 file\(s\)/);
});

// Fixture slugs are assembled at runtime so the scanner (which also runs on
// THIS file in pre-commit) never sees a literal slug shape in the source.
const slug = (letters, digits) => `${letters}-${digits}`;

test("flags archaeology hiding inside a test title", () => {
  const result = scan({
    "titled.test.ts": `it("${slug("E", "04")}: surfaces dispatch failures", () => {});\n`,
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /titled\.test\.ts/);
});

test("flags archaeology inside a block comment", () => {
  const result = scan({
    "block.ts": `/*\n * ${slug("FIX", "02")} rewired the gate before publish.\n */\n`,
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /block\.ts/);
});
