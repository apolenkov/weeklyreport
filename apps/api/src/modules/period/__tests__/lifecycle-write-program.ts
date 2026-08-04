import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import ts from "typescript";

export function programFromTsconfig(tsconfig: string): ts.Program {
  const config = ts.readConfigFile(tsconfig, (path) =>
    readFileSync(path, "utf8"),
  );
  if (config.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(tsconfig),
  );
  return ts.createProgram(parsed.fileNames, parsed.options);
}

export function syntheticProgram(fileName: string, source: string): ts.Program {
  const transitionFile = join(dirname(fileName), "period-transition.ts");
  const files = new Map([
    [fileName, source],
    [
      transitionFile,
      "export function buildTransition(): LifecycleWrite { return {} as LifecycleWrite; } export interface LifecycleWrite { readonly __brand: unique symbol }",
    ],
  ]);
  const host = ts.createCompilerHost({ target: ts.ScriptTarget.ESNext });
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (path) => files.has(path) || ts.sys.fileExists(path);
  host.readFile = (path) => files.get(path) ?? ts.sys.readFile(path);
  host.getSourceFile = (path, languageVersion, onError, shouldCreate) =>
    files.has(path)
      ? ts.createSourceFile(path, files.get(path) ?? "", languageVersion, true)
      : getSourceFile(path, languageVersion, onError, shouldCreate);
  return ts.createProgram(
    [...files.keys()],
    { target: ts.ScriptTarget.ESNext },
    host,
  );
}
