import assert from "node:assert/strict";
import test from "node:test";

import ts from "typescript";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const PROBE_PATH = `${REPO_ROOT}scripts/gates/type-system/exact-optional-property-types.probe.ts`;
const PROBE_SOURCE = `
  interface Probe {
    value?: string;
  }
  const invalid: Probe = { value: undefined };
  void invalid;
`;

function probeDiagnostics(exactOptionalPropertyTypes: boolean) {
  const options: ts.CompilerOptions = {
    exactOptionalPropertyTypes,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  };
  const defaultHost = ts.createCompilerHost(options);
  const host: ts.CompilerHost = {
    ...defaultHost,
    fileExists: (fileName) =>
      fileName === PROBE_PATH || defaultHost.fileExists(fileName),
    getSourceFile: (fileName, languageVersion, onError, shouldCreateNew) =>
      fileName === PROBE_PATH
        ? ts.createSourceFile(
            fileName,
            PROBE_SOURCE,
            languageVersion,
            true,
            ts.ScriptKind.TS,
          )
        : defaultHost.getSourceFile(
            fileName,
            languageVersion,
            onError,
            shouldCreateNew,
          ),
    readFile: (fileName) =>
      fileName === PROBE_PATH ? PROBE_SOURCE : defaultHost.readFile(fileName),
  };
  return ts.getPreEmitDiagnostics(
    ts.createProgram([PROBE_PATH], options, host),
  );
}

void test("the shared compiler config permanently enables exact optional properties", () => {
  const configPath = `${REPO_ROOT}tsconfig.base.json`;
  const loaded = ts.readConfigFile(configPath, (fileName) =>
    ts.sys.readFile(fileName),
  );
  assert.equal(loaded.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    REPO_ROOT,
    {},
    configPath,
  );
  assert.equal(parsed.options.exactOptionalPropertyTypes, true);
});

void test("a planted explicit-undefined assignment fails only with the gate enabled", () => {
  assert.equal(probeDiagnostics(false).length, 0);
  const enabledDiagnostics = probeDiagnostics(true);
  assert.ok(
    enabledDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === 2375 && diagnostic.file?.fileName === PROBE_PATH,
    ),
  );
});
