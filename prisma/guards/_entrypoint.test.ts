import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isEntrypoint } from "./_entrypoint.js";

let fixtureDirectory: string;
let scriptPath: string;
let aliasPath: string;
let otherPath: string;

const isEntrypointFor = (argvPath: string, modulePath: string): boolean => {
  const previousArgv = process.argv;
  process.argv = [process.execPath, argvPath];
  try {
    return isEntrypoint(pathToFileURL(modulePath).href);
  } finally {
    process.argv = previousArgv;
  }
};

beforeEach(() => {
  fixtureDirectory = mkdtempSync(join(tmpdir(), "entrypoint-"));
  scriptPath = join(fixtureDirectory, "operation.ts");
  otherPath = join(fixtureDirectory, "other.ts");
  aliasPath = join(fixtureDirectory, "operation-alias.ts");
  writeFileSync(scriptPath, "export {};\n");
  writeFileSync(otherPath, "export {};\n");
  symlinkSync(scriptPath, aliasPath);
});

afterEach(() => {
  rmSync(fixtureDirectory, { recursive: true, force: true });
});

describe("isEntrypoint", () => {
  it("recognizes a direct invocation by its absolute path", () => {
    expect(isEntrypointFor(scriptPath, scriptPath)).toBe(true);
  });

  it("recognizes a direct invocation by a cwd-relative argv path", () => {
    expect(
      isEntrypointFor(relative(process.cwd(), scriptPath), scriptPath),
    ).toBe(true);
  });

  it("recognizes the entrypoint when argv names a symlink alias", () => {
    expect(isEntrypointFor(aliasPath, scriptPath)).toBe(true);
  });

  it("recognizes the entrypoint when the module URL is a symlink alias", () => {
    expect(isEntrypointFor(scriptPath, aliasPath)).toBe(true);
  });

  it("rejects another script in the same directory", () => {
    expect(isEntrypointFor(otherPath, scriptPath)).toBe(false);
  });

  it("rejects an argv path that is not on disk", () => {
    expect(
      isEntrypointFor(join(fixtureDirectory, "absent.ts"), scriptPath),
    ).toBe(false);
  });

  it("propagates a filesystem error other than ENOENT for the argv path", () => {
    // A self-referential symlink makes realpath fail with ELOOP; only a
    // missing file may be read as "not the entrypoint".
    const loopPath = join(fixtureDirectory, "loop.ts");
    symlinkSync("loop.ts", loopPath);
    let thrown: unknown = null;
    try {
      isEntrypointFor(loopPath, scriptPath);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: "ELOOP" });
  });

  it("rejects an invocation without process.argv[1]", () => {
    const previousArgv = process.argv;
    process.argv = [process.execPath];
    try {
      expect(isEntrypoint(pathToFileURL(scriptPath).href)).toBe(false);
    } finally {
      process.argv = previousArgv;
    }
  });
});
