// Where the web app touches a tRPC procedure, split into the sites this audit
// can follow and the ones it cannot.
//
// The split is an ALLOWLIST, deliberately. Enumerating unfollowable call styles
// — useMutation, mutate, a destructured mutationOptions — is a blocklist, and a
// blocklist is incomplete the moment someone writes the next one. So every
// reference to a procedure path counts as unfollowable unless it is the callee
// of a `mutationOptions(...)` call, which is the one shape the read-back
// analysis knows how to walk.

import ts from "typescript";

import { propertyChain } from "./expression-resolver.mjs";
import { modules, walk } from "./web-module-graph.mjs";

const READABLE_CALL = "mutationOptions";

const procedureOf = (chain) =>
  chain && chain.length > 1 ? chain.slice(1).join(".") : null;

const readableCallee = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === READABLE_CALL
    ? node.expression.expression
    : null;

// The deepest property access is the reference; its ancestors are the same
// reference seen from further out. Collecting only the longest chain per
// position keeps `trpc.a.b.c` from counting as references to `trpc.a` too.
function references(module) {
  const readable = [];
  const seen = new Set();
  const all = walk(module.source, (node) => {
    const target = readableCallee(node);
    if (target) {
      const procedure = procedureOf(propertyChain(target));
      if (procedure) {
        readable.push({ procedure, call: node, module });
        seen.add(target);
      }
      return [];
    }
    const destructured = destructuredProcedures(node, module);
    if (destructured) return destructured;
    if (!ts.isPropertyAccessExpression(node) || seen.has(node)) return [];
    const procedure = procedureOf(propertyChain(node));
    return procedure ? [{ procedure, node, module }] : [];
  });
  return { readable, all };
}

// `const { saveUser } = trpc.admin` reaches a procedure without ever writing its
// path, so the chain walk sees only `trpc.admin` and discards it as a prefix.
// Rebuild the path from the namespace plus each bound name; otherwise a
// destructured call site is invisible while the procedure keeps whatever verdict
// its other call sites earned.
function destructuredProcedures(node, module) {
  if (
    !ts.isVariableDeclaration(node) ||
    !ts.isObjectBindingPattern(node.name) ||
    !node.initializer
  ) {
    return null;
  }
  const namespace = procedureOf(propertyChain(node.initializer));
  if (namespace === null) return null;
  return node.name.elements.flatMap((element) => {
    const source = element.propertyName ?? element.name;
    return ts.isIdentifier(source)
      ? [{ procedure: `${namespace}.${source.text}`, node, module }]
      : [];
  });
}

const index = (sites) =>
  sites.reduce(
    (map, site) =>
      map.set(site.procedure, [...(map.get(site.procedure) ?? []), site]),
    new Map(),
  );

const scanned = modules().map(references);

export const MUTATION_SITES = index(scanned.flatMap((r) => r.readable));

// A reference that is not a readable call site, and is not a prefix of one.
// Prefixes matter: `trpc.admin.saveUser.mutationOptions(...)` contains the
// shorter chain `trpc.admin`, which is not a procedure anyone called.
const isPrefixOfKnown = (procedure) =>
  [...MUTATION_SITES.keys()].some((known) => known.startsWith(`${procedure}.`));

export const UNREADABLE_SITES = index(
  scanned
    .flatMap((r) => r.all)
    .filter(
      (site) =>
        MUTATION_SITES.has(site.procedure) && !isPrefixOfKnown(site.procedure),
    ),
);
