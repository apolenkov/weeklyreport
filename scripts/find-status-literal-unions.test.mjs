import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const scriptPath = fileURLToPath(
  new URL("./find-status-literal-unions.mjs", import.meta.url),
);

const scan = (fixtures) => {
  const dir = mkdtempSync(join(tmpdir(), "status-union-gate-"));
  const paths = Object.entries(fixtures).map(([name, content]) => {
    const p = join(dir, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content);
    return p;
  });
  // cwd = fixture root so allowlist entries resolve against it, mirroring how
  // the real gate resolves them against the repo root.
  return spawnSync(process.execPath, [scriptPath, ...paths], {
    cwd: dir,
    encoding: "utf8",
  });
};

test("a full traffic-light union fires, extras included", () => {
  const result = scan({
    "a.ts": `type S = "green" | "yellow" | "red";`,
    "b.tsx": `type S = "red" | "empty" | "green" | "yellow";`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /a\.ts/);
  assert.match(result.stdout, /b\.tsx/);
  assert.match(result.stdout, /TrafficLightStatus/);
  assert.match(result.stdout, /2 status literal-union hit\(s\)/);
});

test("an exact draft|published union fires, either order, multi-line too", () => {
  const result = scan({
    "a.ts": `type S = "published" | "draft";`,
    "b.ts": `type S =\n  | "draft"\n  | "published";`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ReportStatus/);
  assert.match(result.stdout, /2 status literal-union hit\(s\)/);
});

test("z.enum re-declarations fire for both vocabularies", () => {
  const result = scan({
    "a.ts": `const s = z.enum(["green", "yellow", "red"]);`,
    "b.ts": `const s = z.enum([\n  "draft",\n  "published",\n]);`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /2 status literal-union hit\(s\)/);
});

test("test files are covered", () => {
  const result = scan({
    "a.test.ts": `type S = "green" | "yellow" | "red";`,
  });
  assert.equal(result.status, 1);
});

test("subsets, compositions, and distinct vocabularies pass", () => {
  const result = scan({
    // color subset (activity-alarm shape)
    "a.ts": `type Floor = "yellow" | "red";`,
    // composition from the shared type
    "b.ts": `type Cell = TrafficLightStatus | "empty";`,
    // distinct vocabulary including draft+published among other literals
    "c.ts": `type H = "submitted" | "draft" | "published" | "archived";`,
    // value list, not a type re-declaration
    "d.ts": `const COLORS = ["green", "yellow", "red"] as const;`,
  });
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /0 status literal-union hit\(s\)/);
});

test("comments do not fire", () => {
  const result = scan({
    "a.ts": `// legacy shape was "green" | "yellow" | "red"\n/* or "draft" | "published" */\nconst x = 1;`,
  });
  assert.equal(result.status, 0, result.stdout);
});

test("backtick literal types fire", () => {
  const result = scan({
    "a.ts": "type S = `green` | `yellow` | `red`;",
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /TrafficLightStatus/);
});

test("z.union of z.literal chains fires for both vocabularies", () => {
  const result = scan({
    "a.ts": `const s = z.union([z.literal("green"), z.literal("yellow"), z.literal("red")]);`,
    "b.ts": `const s = z.union([z.literal("draft"), z.literal("published")]);`,
    // non-literal union members must not false-positive
    "c.ts": `const s = z.union([z.string(), z.number()]);`,
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /2 status literal-union hit\(s\)/);
});

test("a // inside a string does not hide a union on the same line", () => {
  const result = scan({
    "a.ts": `const u = "//cdn.example.com"; type S = "green" | "yellow" | "red";`,
    "b.ts": `const g = "src//deep"; type S = "draft" | "published";`,
    "c.ts": `const h = "https://x.dev"; type S = "green" | "yellow" | "red";`,
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /3 status literal-union hit\(s\)/);
});

test("the canonical presentation vocabulary fires outside its SSOT", () => {
  const result = scan({
    "a.ts": `type S = "on-track" | "at-risk" | "blocked" | "empty";`,
    "b.ts": `const s = z.enum(["blocked", "at-risk", "on-track", "empty", "extra"]);`,
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /CanonicalStatus/);
  assert.match(result.stdout, /2 status literal-union hit\(s\)/);
});

test("canonical subsets and aliases pass", () => {
  const result = scan({
    // the risk-severity pair (riskSeveritySchema shape)
    "a.ts": `const s = z.enum(["at-risk", "blocked"]);`,
    // alias composition, no literals
    "b.ts": `type StageStatus = CanonicalStatus;`,
  });
  assert.equal(result.status, 0, result.stdout);
});

test("the allowlist passes at its repo-rooted paths only", () => {
  const result = scan({
    "prisma/seed-constants.ts": `type S = { status: "draft" | "published" };`,
    "packages/shared/src/schemas/report-primitives.schema.ts": `const s = z.enum(["green", "yellow", "red"]);`,
    "apps/web/src/lib/status-presentation.ts": `type C = "blocked" | "at-risk" | "on-track" | "empty";`,
    "packages/shared/src/schemas/auth.ts": `const s = z.enum(["lead", "head", "admin", "viewer"]);`,
  });
  assert.equal(result.status, 0, result.stdout);
});

test("the role vocabulary fires outside its SSOT", () => {
  const result = scan({
    "a.ts": `type R = "lead" | "head" | "admin" | "viewer";`,
    "b.ts": `const s = z.enum(["viewer", "admin", "head", "lead", "extra"]);`,
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /Role\/DbRole/);
  assert.match(result.stdout, /2 status literal-union hit\(s\)/);
});

test("role subsets and value lists pass", () => {
  const result = scan({
    // a narrower subset (e.g. a leadership-only check) stays legal
    "a.ts": `type Leadership = "head" | "admin";`,
    // a value list (as const), not a type re-declaration
    "b.ts": `const ROLES = ["lead", "head", "admin", "viewer"] as const;`,
  });
  assert.equal(result.status, 0, result.stdout);
});

test("a same-named file elsewhere is NOT allowlisted", () => {
  const result = scan({
    "apps/api/prisma/seed-constants.ts": `type S = "draft" | "published";`,
  });
  assert.equal(result.status, 1, result.stdout);
});

test("declaration files and ignored trees are skipped", () => {
  const result = scan({
    "a.d.ts": `type S = "green" | "yellow" | "red";`,
    "dist/b.ts": `type S = "draft" | "published";`,
  });
  assert.equal(result.status, 0, result.stdout);
});
