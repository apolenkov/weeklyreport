import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { transformModuleSource } from "./fix-esm-extensions.mjs";

// The post-build rewrite must only touch real module specifiers. The old
// regex pass also rewrote `from './x'` / `import('./x')` text inside string
// literals and comments whenever a matching file existed on disk — corrupting
// runtime strings. These fixtures pin that those traps stay byte-identical.
const fixtureRoot = mkdtempSync(join(tmpdir(), "fix-esm-extensions-"));
const apiDistSrc = join(fixtureRoot, "api/apps/api/src");
const apiSharedDistRoot = join(fixtureRoot, "api/packages/shared/src");

const SHARED_SPECIFIER = "@customreport/shared";

const roots = { apiDistSrc, apiSharedDistRoot };

beforeAll(() => {
  mkdirSync(apiDistSrc, { recursive: true });
  mkdirSync(apiSharedDistRoot, { recursive: true });
  writeFileSync(join(apiDistSrc, "dep.js"), "export const dep = 1;\n");
  writeFileSync(join(apiSharedDistRoot, "index.js"), "export const x = 1;\n");
});

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function file(path) {
  return join(apiDistSrc, path);
}

describe("fix-esm-extensions transformModuleSource", () => {
  it("rewrites real import/export/dynamic-import specifiers", () => {
    const source = [
      'import { a } from "./dep";',
      'import "./dep";',
      'export { b } from "./dep";',
      'export * from "./dep";',
      'const d = import("./dep");',
      `import { x } from "${SHARED_SPECIFIER}";`,
    ].join("\n");

    const result = transformModuleSource(source, file("mod.js"), roots);

    expect(result.source).toBe(
      [
        'import { a } from "./dep.js";',
        'import "./dep.js";',
        'export { b } from "./dep.js";',
        'export * from "./dep.js";',
        'const d = import("./dep.js");',
        'import { x } from "../../../packages/shared/src/index.js";',
      ].join("\n"),
    );
    expect(result.changedSpecifiers).toBe(6);
  });

  it("leaves import-shaped string literals, comments, template and regex traps byte-identical", () => {
    const traps = [
      "const msg = \"from './dep'\";",
      "// import('./dep')",
      '/* from "./dep" */',
      "const tpl = `from './dep'`;",
      "const re = /from '\\.\\/dep'/;",
      "const s = \"path/from './dep'\";",
    ].join("\n");
    const source = `import { a } from "./dep";\n${traps}`;

    const result = transformModuleSource(source, file("traps.js"), roots);

    expect(result.source).toBe(`import { a } from "./dep.js";\n${traps}`);
    expect(result.changedSpecifiers).toBe(1);
  });

  it("rewrites @customreport/shared only for api-dist files", () => {
    const apiOut = transformModuleSource(
      `import { x } from "${SHARED_SPECIFIER}";`,
      file("shared-import.js"),
      roots,
    ).source;
    expect(apiOut).toBe(
      'import { x } from "../../../packages/shared/src/index.js";',
    );

    const nonApiOut = transformModuleSource(
      `import { x } from "${SHARED_SPECIFIER}";`,
      join(apiSharedDistRoot, "peer.js"),
      roots,
    ).source;
    expect(nonApiOut).toBe(`import { x } from "${SHARED_SPECIFIER}";`);
  });

  it("is a no-op when every specifier already carries its extension", () => {
    const source = [
      'import { a } from "./dep.js";',
      'export { b } from "./dep.js";',
      'const d = import("./dep.js");',
    ].join("\n");

    const result = transformModuleSource(
      source,
      file("already-fixed.js"),
      roots,
    );

    expect(result.source).toBe(source);
    expect(result.changedSpecifiers).toBe(0);
  });
});
