// Answering "what does this name stand for?" across the web sources: the value
// a binding holds, the function a factory call produces, the object a callbacks
// factory returns. Every entry point returns null rather than a guess.

import ts from "typescript";

import {
  isFunctionLike,
  lookup,
  returnedExpression,
} from "./web-module-graph.mjs";

// Hops through names and members; a cap is what terminates a mutual reference.
const MAX_RESOLVE_HOPS = 8;
// How a tanstack-query key is spelled at a call site, whichever helper builds it.
const KEY_HELPERS = new Set([
  "pathFilter",
  "queryKey",
  "queryOptions",
  "queryFilter",
]);

export function propertyChain(node) {
  if (ts.isIdentifier(node)) return [node.text];
  if (!ts.isPropertyAccessExpression(node)) return null;
  const head = propertyChain(node.expression);
  return head ? [...head, node.name.text] : null;
}

// `trpc.admin.jobs.listFailed.queryKey()` → "admin.jobs.listFailed": the chain
// between the client root and the key helper is the procedure path.
export function queryPathOf(node) {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  const isKeyHelper =
    ts.isPropertyAccessExpression(callee) && KEY_HELPERS.has(callee.name.text);
  if (!isKeyHelper) return null;
  const chain = propertyChain(callee.expression);
  return chain && chain.length > 1 ? chain.slice(1).join(".") : null;
}

export function memberOf(objectLiteral, name) {
  const property = objectLiteral.properties.find(
    (candidate) => candidate.name?.getText() === name,
  );
  if (!property) return null;
  if (ts.isPropertyAssignment(property)) return property.initializer;
  return ts.isShorthandPropertyAssignment(property) ? property.name : null;
}

// The value a name or a member access stands for, in the module that owns it.
export function resolveExpr(node, module, hops) {
  if (!node || hops > MAX_RESOLVE_HOPS) return null;
  if (ts.isIdentifier(node)) {
    const found = lookup(node, module);
    return found ? resolveExpr(found.node, found.module, hops + 1) : null;
  }
  if (ts.isElementAccessExpression(node)) return null;
  if (!ts.isPropertyAccessExpression(node)) return { node, module };
  const owner = resolveExpr(node.expression, module, hops + 1);
  const member =
    owner && ts.isObjectLiteralExpression(owner.node)
      ? memberOf(owner.node, node.name.text)
      : null;
  return member ? resolveExpr(member, owner.module, hops + 1) : null;
}

// A handler is often produced rather than written: `notifyDone("Published")`
// resolves through the factory to the arrow it hands back.
export function resolveFunction(node, module, hops) {
  const target = resolveExpr(node, module, hops);
  if (!target) return null;
  if (isFunctionLike(target.node)) return target;
  if (!ts.isCallExpression(target.node)) return null;
  const producer = resolveFunction(
    target.node.expression,
    target.module,
    hops + 1,
  );
  return producer
    ? resolveFunction(
        returnedExpression(producer.node),
        producer.module,
        hops + 1,
      )
    : null;
}

// The options object, whether written inline or built by a callbacks factory.
export function resolveObject(node, module, hops) {
  const target = resolveExpr(node, module, hops);
  if (!target) return null;
  if (ts.isObjectLiteralExpression(target.node)) return target;
  if (!ts.isCallExpression(target.node)) return null;
  const producer = resolveFunction(
    target.node.expression,
    target.module,
    hops + 1,
  );
  return producer
    ? resolveObject(
        returnedExpression(producer.node),
        producer.module,
        hops + 1,
      )
    : null;
}

export function rootIdentifier(expr) {
  if (ts.isIdentifier(expr)) return expr;
  return ts.isPropertyAccessExpression(expr)
    ? rootIdentifier(expr.expression)
    : null;
}
