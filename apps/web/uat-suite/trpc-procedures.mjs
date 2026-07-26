// Every procedure the API router tree exposes, with the namespace a web caller
// writes: trpc.<namespace>.<procedure>.
//
// Any shape this extractor cannot resolve is a hard stop, never a skip: the
// previous line-based parser silently matched nothing after the router tree was
// split into factories, so the gate passed on an empty set for months.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "../../..");
const TRPC_DIR = path.join(REPO_ROOT, "apps/api/src/infrastructure/trpc");
const ROUTER_PATH = path.join(TRPC_DIR, "trpc.router.ts");
const ROUTERS_DIR = path.join(TRPC_DIR, "routers");

function fail(message, node) {
  console.error(`[mutation-audit] FAIL: ${message}${locationOf(node)}`);
  process.exit(2);
}

function locationOf(node) {
  if (!node) return "";
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart());
  return ` (${path.relative(REPO_ROOT, source.fileName)}:${line + 1})`;
}

function parseSource(file) {
  const source = readFileSync(file, "utf8");
  // setParentNodes: getSourceFile()/getStart() on nested nodes drive `fail`.
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

function routerSourceFiles() {
  const nested = readdirSync(ROUTERS_DIR, { recursive: true })
    .filter((rel) => rel.endsWith(".ts") && !rel.endsWith(".test.ts"))
    .map((rel) => path.join(ROUTERS_DIR, rel));
  return [ROUTER_PATH, ...nested];
}

// The expression a factory hands back: `=> router({…})` or a `return` in a block.
function returnedExpression(fn) {
  if (!fn.body) return null;
  if (!ts.isBlock(fn.body)) return fn.body;
  return fn.body.statements.find(ts.isReturnStatement)?.expression ?? null;
}

// What a name stands for once resolved: a function contributes what it
// returns, any other binding contributes its initializer.
function declaredValue(initializer) {
  const isFunction =
    ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
  return isFunction ? returnedExpression(initializer) : initializer;
}

function namedDeclaration(node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return { name: node.name.text, expr: returnedExpression(node) };
  }
  const isNamedBinding =
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer;
  if (!isNamedBinding) return null;
  return { name: node.name.text, expr: declaredValue(node.initializer) };
}

// Names are file-local in source but global here; ambiguity fails loud below
// rather than resolving to whichever declaration was parsed last.
function declarationsIn(source) {
  const found = [];
  const visit = (node) => {
    const declaration = namedDeclaration(node);
    if (declaration) found.push(declaration);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

const DECLARATIONS = routerSourceFiles()
  .map(parseSource)
  .flatMap(declarationsIn)
  .reduce(
    (map, declaration) =>
      map.set(declaration.name, [
        ...(map.get(declaration.name) ?? []),
        declaration.expr,
      ]),
    new Map(),
  );

function lookupDeclaration(name, node) {
  const matches = DECLARATIONS.get(name) ?? [];
  if (matches.length === 1) return matches[0];
  const reason =
    matches.length === 0
      ? `unknown router binding \`${name}\``
      : `ambiguous router binding \`${name}\` (${matches.length} declarations)`;
  return fail(reason, node);
}

function resolveCall(expr) {
  const callee = expr.expression;
  if (ts.isPropertyAccessExpression(callee)) {
    const kind = callee.name.text;
    if (kind === "query" || kind === "mutation")
      return { type: "procedure", kind };
    return null;
  }
  if (!ts.isIdentifier(callee)) return null;
  if (callee.text === "router") return resolveExpression(expr.arguments[0]);
  return resolveExpression(lookupDeclaration(callee.text, callee));
}

// A namespace (`router({…})` or the bare object a `*Procedures` factory
// returns) or a single procedure — a factory call looks identical either way
// at the call site, so only its return expression settles which.
function resolveExpression(expr) {
  if (!expr) return null;
  if (ts.isCallExpression(expr)) return resolveCall(expr);
  if (ts.isIdentifier(expr)) {
    return resolveExpression(lookupDeclaration(expr.text, expr));
  }
  if (ts.isObjectLiteralExpression(expr)) {
    return { type: "namespace", entries: expr.properties.flatMap(entriesOf) };
  }
  return null;
}

function entriesOf(property) {
  if (ts.isPropertyAssignment(property)) {
    return [{ name: property.name.getText(), expr: property.initializer }];
  }
  if (ts.isShorthandPropertyAssignment(property)) {
    return [{ name: property.name.text, expr: property.name }];
  }
  if (!ts.isSpreadAssignment(property)) {
    return fail("unsupported router member", property);
  }
  const spread = resolveExpression(property.expression);
  if (spread?.type !== "namespace") {
    return fail("spread member is not a procedure group", property);
  }
  return spread.entries;
}

function flattenProcedures(node, trail) {
  if (node.type === "procedure") {
    return [
      {
        namespace: trail.slice(0, -1).join("."),
        name: trail.at(-1),
        kind: node.kind,
      },
    ];
  }
  return node.entries.flatMap((entry) => {
    const resolved =
      resolveExpression(entry.expr) ??
      fail(
        `cannot classify \`${[...trail, entry.name].join(".")}\``,
        entry.expr,
      );
    return flattenProcedures(resolved, [...trail, entry.name]);
  });
}

export function extractProcedures() {
  const root = resolveExpression(lookupDeclaration("createAppRouter"));
  if (root?.type !== "namespace") {
    return fail("createAppRouter does not resolve to a router");
  }
  return flattenProcedures(root, []);
}
