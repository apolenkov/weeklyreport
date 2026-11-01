// C3778 (TASK-503.117): proves the canonical guard under the real tsx loader
// in a child process, because the sibling in-process suite only substitutes
// process.argv in the current process. Consumers launch the guard's callers
// with `tsx prisma/seeds/...` (see package.json), so this mirrors that.
// Platform: symlink and tmpdir cases verified on macOS/Linux only; file name
// case sensitivity is not checked.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const ENTRYPOINT = join(ROOT, "prisma/guards/_entrypoint.ts");

const RUN_SOURCE = `import { isEntrypoint } from ${JSON.stringify(ENTRYPOINT)};

if (isEntrypoint(import.meta.url)) console.log("ENTRYPOINT-RAN");
`;

const MAIN_SOURCE = `import "./run.ts";

console.log("MAIN");
`;

interface ChildOutcome {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

// cwd must be the repository root so that `--import tsx` resolves tsx from
// the workspace node_modules.
const spawnNode = (scriptPath: string): ChildOutcome =>
  spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
  });

const spawnTsxBin = (scriptPath: string): ChildOutcome =>
  spawnSync(join(ROOT, "node_modules", ".bin", "tsx"), [scriptPath], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
  });

let fixtureDirectory: string;
let runPath: string;
let linkPath: string;
let mainPath: string;

beforeEach(() => {
  fixtureDirectory = mkdtempSync(join(tmpdir(), "entrypoint-loader-"));
  runPath = join(fixtureDirectory, "run.ts");
  linkPath = join(fixtureDirectory, "run-link.ts");
  mainPath = join(fixtureDirectory, "main.ts");
  writeFileSync(runPath, RUN_SOURCE);
  symlinkSync(runPath, linkPath);
  writeFileSync(mainPath, MAIN_SOURCE);
});

afterEach(() => {
  rmSync(fixtureDirectory, { recursive: true, force: true });
});

describe("isEntrypoint through the real tsx loader", () => {
  it("L1: runs the guard for a direct launch by absolute path", () => {
    const result = spawnNode(runPath);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ENTRYPOINT-RAN");
  });

  it("L2: runs the guard for a launch by a path relative to the repo root", () => {
    const result = spawnNode(relative(ROOT, runPath));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ENTRYPOINT-RAN");
  });

  it("L3: runs the guard for a launch through a symlink alias", () => {
    const result = spawnNode(linkPath);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ENTRYPOINT-RAN");
  });

  it("L4: does not run the guard when the fixture is only imported", () => {
    const result = spawnNode(mainPath);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("MAIN");
    expect(result.stdout).not.toContain("ENTRYPOINT-RAN");
  });

  it("L5: runs the guard for a launch through the tsx binary directly", () => {
    const result = spawnTsxBin(runPath);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ENTRYPOINT-RAN");
  });
});
