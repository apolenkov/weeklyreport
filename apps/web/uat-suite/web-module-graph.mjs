// Name resolution across apps/web/src, sized for one question: what does a
// mutation's success handler ultimately call? Test files are excluded from the
// graph — a read-back wired only from a test is not one a user ever sees.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WEB_SRC = path.resolve(HERE, "../src");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const MODULE_CANDIDATES = [".ts", ".tsx", "/index.ts", "/index.tsx"];
// A name bound twice in one file (or called from two places) resolves to
// nothing rather than to whichever declaration was visited last.
export const AMBIGUOUS = Symbol("ambiguous");

function sourceFilesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFilesIn(full);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

const ALL_FILES = sourceFilesIn(WEB_SRC);

// Consumer counting keeps reading every file, tests included: that corpus
// decides BLACK HOLE, and its behaviour is deliberately left untouched.
export const webSourceTexts = ALL_FILES.map((file) =>
  readFileSync(file, "utf8"),
);

const isProductFile = (file) => !/\.test\.tsx?$/.test(file);

function childrenOf(node) {
  const found = [];
  ts.forEachChild(node, (child) => {
    found.push(child);
  });
  return found;
}

// Depth-first over a whole subtree; `visit` returns the findings for one node.
export function walk(node, visit) {
  return [
    ...visit(node),
    ...childrenOf(node).flatMap((child) => walk(child, visit)),
  ];
}

export function isFunctionLike(node) {
  return (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node)
  );
}

// What a function hands back: `=> expr` directly, or the `return` in a block.
export function returnedExpression(fn) {
  if (!fn.body) return null;
  if (!ts.isBlock(fn.body)) return fn.body;
  return fn.body.statements.find(ts.isReturnStatement)?.expression ?? null;
}

function namedBinding(node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return { name: node.name.text, value: node };
  }
  const isNamed =
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer;
  return isNamed ? { name: node.name.text, value: node.initializer } : null;
}

// Every named binding at any depth: the helpers that matter here are usually
// consts declared inside a hook, not top-level exports.
function bindingsIn(source) {
  return walk(source, (node) => {
    const binding = namedBinding(node);
    return binding ? [binding] : [];
  });
}

function bindingNameOf(fn) {
  if (ts.isFunctionDeclaration(fn)) return fn.name?.text ?? null;
  const parent = fn.parent;
  const named =
    parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name);
  return named ? parent.name.text : null;
}

function parameterIndex(fn, name) {
  return fn.parameters.findIndex(
    (parameter) =>
      ts.isIdentifier(parameter.name) && parameter.name.text === name,
  );
}

// Which function declares this name as a parameter, walking outwards from the
// use site so a shadowed name resolves to the function that really owns it.
function ownerOfParameter(node, name) {
  if (!node.parent) return null;
  const index = isFunctionLike(node) ? parameterIndex(node, name) : -1;
  if (index < 0) return ownerOfParameter(node.parent, name);
  const owner = bindingNameOf(node);
  return owner ? { owner, index } : null;
}

function resolveSpecifier(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  return (
    MODULE_CANDIDATES.map((suffix) => `${base}${suffix}`).find((candidate) =>
      PARSED.has(candidate),
    ) ?? null
  );
}

function importedNames(clause) {
  const named = clause.namedBindings;
  const fromList =
    named && ts.isNamedImports(named)
      ? named.elements.map((element) => element.name.text)
      : [];
  return clause.name ? [clause.name.text, ...fromList] : fromList;
}

// A relative import resolves to a file; anything else (react, sonner, the
// shared package) resolves to null and is treated as a library call.
function importsIn(source, file) {
  return source.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !statement.importClause)
      return [];
    const specifier = statement.moduleSpecifier.text;
    const target = specifier.startsWith(".")
      ? resolveSpecifier(file, specifier)
      : null;
    return importedNames(statement.importClause).map((name) => ({
      name,
      value: target,
    }));
  });
}

const indexByName = (entries) =>
  entries.reduce(
    (map, entry) =>
      map.set(entry.name, map.has(entry.name) ? AMBIGUOUS : entry.value),
    new Map(),
  );

function parseModule(file) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  return { file, source, bindings: indexByName(bindingsIn(source)) };
}

// Two passes because import targets are file paths: the set of parsed files has
// to exist before a specifier can be resolved against it.
const PARSED = new Map(
  ALL_FILES.filter(isProductFile).map((file) => [file, parseModule(file)]),
);

const MODULES = new Map(
  [...PARSED].map(([file, module]) => [
    file,
    { ...module, imports: indexByName(importsIn(module.source, file)) },
  ]),
);

export const modules = () => [...MODULES.values()];

const callsIn = (module) =>
  walk(module.source, (node) =>
    ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      ? [{ name: node.expression.text, value: { call: node, module } }]
      : [],
  );

const CALL_SITES = indexByName(modules().flatMap(callsIn));

const single = (entry) => (entry && entry !== AMBIGUOUS ? entry : null);

// A parameter stands for the argument its caller passed — but only when the
// function that declares it is called exactly once in the whole web app.
function fromParameter(nameNode, module) {
  const slot = ownerOfParameter(nameNode, nameNode.text);
  const site = slot && single(CALL_SITES.get(slot.owner));
  const argument = site?.call.arguments[slot.index];
  return argument ? { node: argument, module: site.module } : null;
}

function fromImport(name, module) {
  const target = module.imports.get(name);
  if (typeof target !== "string") return null;
  const source = MODULES.get(target);
  const value = single(source?.bindings.get(name));
  return value ? { node: value, module: source } : null;
}

// Where a name used at `nameNode` actually comes from: a binding in the file,
// a relative import, or the argument passed for a parameter.
export function lookup(nameNode, module) {
  const local = single(module.bindings.get(nameNode.text));
  if (local) return { node: local, module };
  return fromImport(nameNode.text, module) ?? fromParameter(nameNode, module);
}

// True when the name comes from a package rather than from our own source, so
// a call to it can be ignored instead of counted as an unfollowable step.
export const isLibraryName = (name, module) =>
  module.imports.get(name) === null;
