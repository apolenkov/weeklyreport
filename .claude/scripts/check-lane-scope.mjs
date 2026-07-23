#!/usr/bin/env node
// Echo-back guard, enforceable half: after implement lanes finish, every
// dirty product file must belong to a declared lane scope. Catches both
// silent scope expansion by an implementer and files a lane touched but the
// orchestrator's per-seam commit plan would miss.
//
// Usage:
//   node .claude/scripts/check-lane-scope.mjs --scopes scopes.json
// where scopes.json is {"laneName": ["path/or/dir", ...], ...}. A scope entry
// matches a dirty file if it equals the path or is a directory prefix.
// Harness paths (.claude/, openspec/, docs/, archive) are always allowed.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ALWAYS_ALLOWED = [".claude/", "openspec/", "docs/"];

const args = process.argv.slice(2);
const scopesIdx = args.indexOf("--scopes");
if (scopesIdx < 0 || !args[scopesIdx + 1]) {
  throw new Error("required: --scopes <scopes.json>");
}
const scopes = JSON.parse(readFileSync(args[scopesIdx + 1], "utf8"));
const allowed = Object.values(scopes).flat();

const porcelain = execFileSync("/usr/bin/git", ["status", "--porcelain"], {
  cwd: ROOT,
  encoding: "utf8",
});
const dirty = porcelain
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3).trim())
  .filter((path) => path.length > 0);

const inScope = (path) =>
  ALWAYS_ALLOWED.some((prefix) => path.startsWith(prefix)) ||
  allowed.some(
    (entry) =>
      path === entry ||
      path.startsWith(entry.endsWith("/") ? entry : `${entry}/`),
  );

const strays = dirty.filter((path) => !inScope(path));

if (strays.length > 0) {
  console.error("OUT-OF-SCOPE dirty files (no lane declared them):");
  strays.forEach((path) => console.error(`  ${path}`));
  process.exit(1);
}
console.log(`lane scopes clean: ${dirty.length} dirty files, 0 strays`);
