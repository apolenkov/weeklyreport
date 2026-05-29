#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, "..");
const repoRoot = resolve(apiRoot, "../..");
const apiDistRoot = resolve(apiRoot, "dist");
const apiSharedDistRoot = resolve(apiDistRoot, "packages/shared/src");

const scanRoots = [
  resolve(apiDistRoot, "apps/api/src"),
  apiSharedDistRoot,
  resolve(repoRoot, "packages/shared/dist"),
].filter(existsSync);

const relativeSpecifierPattern =
  /(?<prefix>\bfrom\s*["']|\bimport\s*["']|\bimport\s*\(\s*["'])(?<specifier>\.{1,2}\/[^"']+)(?<suffix>["'])/g;

const sharedSpecifierPattern =
  /(?<prefix>\bfrom\s*["']|\bimport\s*["']|\bimport\s*\(\s*["'])@customreport\/shared(?<subpath>\/[A-Za-z0-9_./-]+)?(?<suffix>["'])/g;

const jsFiles = [];

for (const root of scanRoots) {
  collectJsFiles(root, jsFiles);
}

let changedFiles = 0;
let changedSpecifiers = 0;

for (const filePath of jsFiles) {
  const source = readFileSync(filePath, "utf8");
  let specifierChanges = 0;

  const withSharedSpecifiers = source.replace(
    sharedSpecifierPattern,
    (match, prefix, subpath = "", suffix) => {
      if (!filePath.startsWith(resolve(apiDistRoot, "apps/api/src"))) {
        return match;
      }

      const targetPath = resolveSharedSpecifier(subpath);
      if (!targetPath) {
        return match;
      }

      specifierChanges += 1;
      return prefix + toRelativeSpecifier(filePath, targetPath) + suffix;
    },
  );

  const next = withSharedSpecifiers.replace(
    relativeSpecifierPattern,
    (match, prefix, specifier, suffix) => {
      if (hasExtension(specifier)) {
        return match;
      }

      const resolvedSpecifier = resolveRelativeSpecifier(filePath, specifier);
      if (resolvedSpecifier === specifier) {
        return match;
      }

      specifierChanges += 1;
      return prefix + resolvedSpecifier + suffix;
    },
  );

  if (next !== source) {
    writeFileSync(filePath, next);
    changedFiles += 1;
    changedSpecifiers += specifierChanges;
  }
}

if (changedFiles > 0) {
  console.log(
    "Fixed ESM specifiers in " +
      changedFiles +
      " files (" +
      changedSpecifiers +
      " specifiers).",
  );
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

function hasExtension(specifier) {
  return [".cjs", ".js", ".json", ".mjs", ".node"].includes(extname(specifier));
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

function resolveSharedSpecifier(subpath) {
  const cleanSubpath = subpath.startsWith("/") ? subpath.slice(1) : subpath;
  const targetBase =
    cleanSubpath.length === 0
      ? resolve(apiSharedDistRoot, "index")
      : resolve(apiSharedDistRoot, cleanSubpath);

  if (existsSync(targetBase + ".js")) {
    return targetBase + ".js";
  }

  if (existsSync(join(targetBase, "index.js"))) {
    return join(targetBase, "index.js");
  }

  return null;
}

function toRelativeSpecifier(fromFile, toFile) {
  let specifier = relative(dirname(fromFile), toFile).split(sep).join("/");

  if (!specifier.startsWith(".")) {
    specifier = "./" + specifier;
  }

  return specifier;
}
