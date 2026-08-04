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

// Only module-specifier literals reachable from the AST are rewritten. String
// literals, comments, template literals and regexes that merely resemble
// `import`/`from` are left byte-identical, so the transform cannot change
// runtime semantics — the property the old regex pass could not guarantee.
export function transformModuleSource(source, filePath, roots) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.JS,
  );
  const isApiDistFile = filePath.startsWith(roots.apiDistSrc);
  const edits = [];

  const rewrite = (specifier, start, end) => {
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

  const maybeRewriteLiteral = (specifier) => {
    // TS6 `isExportDeclaration` matches every export statement, most with no
    // moduleSpecifier at all (e.g. `export class`).
    if (!specifier || !ts.isStringLiteral(specifier)) return;
    rewrite(specifier.text, specifier.getStart(sourceFile), specifier.end);
  };

  const visit = (node) => {
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
    (acc, edit) => acc.slice(0, edit.start) + edit.text + acc.slice(edit.end),
    source,
  );
  return { source: rewritten, changedSpecifiers: edits.length };
}

function resolveSharedSpecifier(roots, subpath) {
  const cleanSubpath = subpath.startsWith("/") ? subpath.slice(1) : subpath;
  const targetBase =
    cleanSubpath.length === 0
      ? resolve(roots.apiSharedDistRoot, "index")
      : resolve(roots.apiSharedDistRoot, cleanSubpath);

  if (existsSync(targetBase + ".js")) {
    return targetBase + ".js";
  }

  if (existsSync(join(targetBase, "index.js"))) {
    return join(targetBase, "index.js");
  }

  return null;
}

function toRelativeSpecifier(fromFile, toFile) {
  const relativeSpecifier = relative(dirname(fromFile), toFile)
    .split(sep)
    .join("/");
  const specifier = relativeSpecifier.startsWith(".")
    ? relativeSpecifier
    : "./" + relativeSpecifier;

  return specifier;
}

function resolveRelativeSpecifier(filePath, specifier) {
  const targetBase = resolve(dirname(filePath), specifier);

  if (existsSync(targetBase + ".js")) {
    return specifier + ".js";
  }

  if (existsSync(join(targetBase, "index.js"))) {
    return specifier + "/index.js";
  }

  return specifier;
}

function collectJsFiles(directory, output) {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      collectJsFiles(absolutePath, output);
      continue;
    }

    if (stats.isFile() && absolutePath.endsWith(".js")) {
      output.push(absolutePath);
    }
  }
}

const roots = { apiDistSrc, apiSharedDistRoot };

// Directory scan + write only when run as the build step's CLI entrypoint; the
// pure transform stays importable so the regression test drives it directly.
function main() {
  const jsFiles = [];

  for (const root of scanRoots) {
    collectJsFiles(root, jsFiles);
  }

  const { changedFiles, changedSpecifiers } = jsFiles.reduce(
    (tally, filePath) => {
      const source = readFileSync(filePath, "utf8");
      const result = transformModuleSource(source, filePath, roots);
      if (result.source === source) return tally;
      writeFileSync(filePath, result.source);
      return {
        changedFiles: tally.changedFiles + 1,
        changedSpecifiers: tally.changedSpecifiers + result.changedSpecifiers,
      };
    },
    { changedFiles: 0, changedSpecifiers: 0 },
  );

  if (changedFiles > 0) {
    console.log(
      "Fixed ESM specifiers in " +
        changedFiles +
        " files (" +
        changedSpecifiers +
        " specifiers).",
    );
  }
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntrypoint) {
  main();
}
