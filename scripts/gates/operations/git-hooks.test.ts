import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const hooks = ["post-merge", "post-rewrite"] as const;

const runHook = (hook: string, changed: string, status: string) => {
  const directory = mkdtempSync(join(tmpdir(), "git-hook-"));
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const log = join(directory, "calls.log");
  const git = join(bin, "git");
  const pnpm = join(bin, "pnpm");
  const path = process.env.PATH;
  assert.ok(path);
  writeFileSync(
    git,
    `#!/bin/sh\ncase "$1" in\n  diff-tree) printf '%s\\n' "${changed}" ;;\n  rev-parse) printf '%s\\n' old-head ;;\nesac\n`,
  );
  writeFileSync(
    pnpm,
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\nexit "${status}"\n`,
  );
  chmodSync(git, 0o755);
  chmodSync(pnpm, 0o755);
  const result = spawnSync("/bin/sh", [resolve(".husky", hook)], {
    env: { ...process.env, PATH: `${bin}:${path}` },
    encoding: "utf8",
    input: "rebase\n",
    timeout: 5000,
  });
  let calls = "";
  try {
    calls = readFileSync(log, "utf8");
  } catch {
    // The hook may fail before invoking pnpm; the assertion below explains it.
  }
  return { calls, result };
};

void test("post-merge and post-rewrite propagate install failures", () => {
  for (const hook of hooks) {
    const { calls, result } = runHook(hook, "package.json", "23");
    assert.equal(result.signal, null);
    assert.equal(result.status, 23, `${hook} masked pnpm install failure`);
    assert.match(calls, /^install$/m);
  }
});

void test("post-merge and post-rewrite propagate generation failures", () => {
  for (const hook of hooks) {
    const { calls, result } = runHook(hook, "prisma/schema.prisma", "24");
    assert.equal(result.signal, null);
    assert.equal(result.status, 24, `${hook} masked prisma generate failure`);
    assert.match(calls, /^exec prisma generate$/m);
  }
});
