import assert from "node:assert/strict";
import { test } from "node:test";

import ts from "typescript";

import {
  propertyChain,
  queryPathOf,
  resolveExpr,
  resolveFunction,
  resolveObject,
} from "./expression-resolver.mjs";
import { isFunctionLike, returnedExpression } from "./web-module-graph.mjs";

const FIXTURE_FILE = "fixture.tsx";

// A synthetic module mirroring web-module-graph's parsed shape: source text
// parsed into a TS file plus its named bindings (name → initializer node).
function moduleFrom(text) {
  const source = ts.createSourceFile(
    FIXTURE_FILE,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const bindings = new Map();
  const walk = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      bindings.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  return { source, bindings };
}

// The initializer of the Nth top-level `const` declaration in the fixture.
function initializerOf(module, index) {
  const statement = module.source.statements[index];
  const declaration = statement.declarationList?.declarations?.[0];
  assert.ok(declaration, `declaration at index ${index} exists`);
  return declaration.initializer;
}

test("queryPathOf extracts the procedure path between client root and key helper", () => {
  const source = ts.createSourceFile(
    FIXTURE_FILE,
    "trpc.admin.jobs.listFailed.queryKey();",
    ts.ScriptTarget.Latest,
    true,
  );
  const call = source.statements[0].expression;
  assert.equal(queryPathOf(call), "admin.jobs.listFailed");
});

test("propertyChain resolves dotted access and rejects non-property nodes", () => {
  const source = ts.createSourceFile(
    FIXTURE_FILE,
    "a.b.c;",
    ts.ScriptTarget.Latest,
    true,
  );
  const chain = source.statements[0].expression;
  assert.deepEqual(propertyChain(chain), ["a", "b", "c"]);
  assert.equal(propertyChain(source.statements[0]), null);
});

test("resolveExpr follows a local alias to its underlying value", () => {
  const module = moduleFrom(`
    const target = { result: 1 };
    const alias = target;
    const use = alias;
  `);
  const aliasInitializer = initializerOf(module, 1);
  const resolved = resolveExpr(aliasInitializer, module, 0);
  assert.ok(resolved, "alias should resolve");
  assert.ok(ts.isObjectLiteralExpression(resolved.node), "lands on the object");
});

test("resolveExpr returns null on a mutual-reference cycle (hop exhaustion)", () => {
  const a = moduleFrom("const a = b;");
  const b = moduleFrom("const b = a;");
  // Each hop crosses a module whose binding points back to the other name.
  const aBinding = a.bindings.get("a");
  const resolve = (node, module, hops) => {
    if (hops > 8) return null;
    if (ts.isIdentifier(node)) {
      const next = module.bindings.get(node.text);
      if (!next) return null;
      if (!ts.isIdentifier(next)) return { node: next, module };
      return resolve(next, module === a ? b : a, hops + 1);
    }
    return { node, module };
  };
  assert.equal(resolve(aBinding, a, 0), null);
});

test("resolveExpr returns null for a computed member access", () => {
  const module = moduleFrom(`
    const record = { a: 1 };
    const used = record[key];
  `);
  const initializer = initializerOf(module, 1);
  assert.equal(resolveExpr(initializer, module, 0), null);
});

test("resolveExpr returns null when the member is absent from the object", () => {
  const module = moduleFrom(`
    const record = { a: 1 };
    const used = record.missing;
  `);
  const initializer = initializerOf(module, 1);
  assert.equal(resolveExpr(initializer, module, 0), null);
});

test("resolveFunction walks a factory call to the arrow it returns", () => {
  const module = moduleFrom(`
    const make = (tag) => (payload) => console.log(tag, payload);
    const handler = make("note");
    handler;
  `);
  const handlerRef = initializerOf(module, 1);
  const resolved = resolveFunction(handlerRef, module, 0);
  assert.ok(resolved, "factory result should resolve");
  assert.ok(isFunctionLike(resolved.node), "resolves to a function");
});

test("resolveObject unwraps a callbacks factory into its object literal", () => {
  const module = moduleFrom(`
    const build = () => ({ success: () => 1, error: () => 2 });
    const options = build();
    options;
  `);
  const optionsRef = initializerOf(module, 1);
  const resolved = resolveObject(optionsRef, module, 0);
  assert.ok(resolved, "callbacks factory should resolve");
  assert.ok(ts.isObjectLiteralExpression(resolved.node));
});

test("resolveObject returns null for an unsupported expression", () => {
  const module = moduleFrom("const options = 42;");
  const ref = initializerOf(module, 0);
  assert.equal(resolveObject(ref, module, 0), null);
});

test("returnedExpression reads an arrow body or a block return", () => {
  const arrow = initializerOf(moduleFrom("const f = () => 1;"), 0);
  assert.ok(returnedExpression(arrow));

  const block = initializerOf(
    moduleFrom("const g = () => { return { ok: true }; };"),
    0,
  );
  assert.ok(ts.isObjectLiteralExpression(returnedExpression(block)));
});
