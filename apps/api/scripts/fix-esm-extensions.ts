#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

export interface TransformRoots {
  readonly apiDistSrc: string;
  readonly apiSharedDistRoot: string;
}

export interface TransformResult {
  readonly source: string;
  readonly changedSpecifiers: number;
}

interface SourceEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, "..");
const repoRoot = resolve(apiRoot, "../..");
const apiDistRoot = resolve(apiRoot, "dist");
const apiDistSrc = resolve(apiDistRoot, "apps/api/src");
const apiSharedDistRoot = resolve(apiDistRoot, "packages/shared/src");

const scanRoots = [
  apiDistSrc,
  apiSharedDistRoot,
  resolve(repoRoot, "packages/shared/dist"),
].filter(existsSync);

// Only AST module-specifier literals are rewritten. Runtime strings, comments,
// templates and regular expressions remain byte-identical.
export function transformModuleSource(
  source: string,
  filePath: string,
  roots: TransformRoots,
): TransformResult {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.JS,
  );
  const isApiDistFile = filePath.startsWith(roots.apiDistSrc);
  const edits: SourceEdit[] = [];

  const rewrite = (specifier: string, start: number, end: number): void => {
    if (specifier.startsWith("@customreport/shared")) {
      if (!isApiDistFile) return;
      const target = resolveSharedSpecifier(
        roots,
        specifier.slice("@customreport/shared".length),
      );
      if (!target) return;
      edits.push({
        start,
        end,
        text: JSON.stringify(toRelativeSpecifier(filePath, target)),
      });
      return;
    }
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) return;
    const resolved = resolveRelativeSpecifier(filePath, specifier);
    if (resolved === specifier) return;
    edits.push({ start, end, text: JSON.stringify(resolved) });
  };

  const maybeRewriteLiteral = (specifier: ts.Expression | undefined): void => {
    if (!specifier || !ts.isStringLiteral(specifier)) return;
    rewrite(specifier.text, specifier.getStart(sourceFile), specifier.end);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      maybeRewriteLiteral(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      maybeRewriteLiteral(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      maybeRewriteLiteral(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (edits.length === 0) return { source, changedSpecifiers: 0 };
  const sorted = [...edits].sort((left, right) => right.start - left.start);
  const rewritten = sorted.reduce(
    (result, edit) =>
      result.slice(0, edit.start) + edit.text + result.slice(edit.end),
    source,
  );
  return { source: rewritten, changedSpecifiers: edits.length };
}

function resolveSharedSpecifier(
  roots: TransformRoots,
  subpath: string,
): string | null {
  const cleanSubpath = subpath.startsWith("/") ? subpath.slice(1) : subpath;
  const targetBase =
    cleanSubpath.length === 0
      ? resolve(roots.apiSharedDistRoot, "index")
      : resolve(roots.apiSharedDistRoot, cleanSubpath);

  if (existsSync(`${targetBase}.js`)) return `${targetBase}.js`;
  const indexPath = join(targetBase, "index.js");
  return existsSync(indexPath) ? indexPath : null;
}

function toRelativeSpecifier(fromFile: string, toFile: string): string {
  const relativeSpecifier = relative(dirname(fromFile), toFile)
    .split(sep)
    .join("/");
  return relativeSpecifier.startsWith(".")
    ? relativeSpecifier
    : `./${relativeSpecifier}`;
}

function resolveRelativeSpecifier(filePath: string, specifier: string): string {
  const targetBase = resolve(dirname(filePath), specifier);
  if (existsSync(`${targetBase}.js`)) return `${specifier}.js`;
  return existsSync(join(targetBase, "index.js"))
    ? `${specifier}/index.js`
    : specifier;
}

function collectJsFiles(directory: string, output: string[]): void {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      collectJsFiles(absolutePath, output);
    } else if (stats.isFile() && absolutePath.endsWith(".js")) {
      output.push(absolutePath);
    }
  }
}

function main(): void {
  const roots = { apiDistSrc, apiSharedDistRoot };
  const jsFiles: string[] = [];
  for (const root of scanRoots) collectJsFiles(root, jsFiles);

  let changedFiles = 0;
  let changedSpecifiers = 0;
  for (const filePath of jsFiles) {
    const source = readFileSync(filePath, "utf8");
    const result = transformModuleSource(source, filePath, roots);
    if (result.source === source) continue;
    writeFileSync(filePath, result.source);
    changedFiles += 1;
    changedSpecifiers += result.changedSpecifiers;
  }

  if (changedFiles > 0) {
    console.log(
      `Fixed ESM specifiers in ${changedFiles} files (${changedSpecifiers} specifiers).`,
    );
  }
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntrypoint) main();
