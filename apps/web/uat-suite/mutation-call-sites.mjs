// Where the web app touches a tRPC procedure, split into the sites this audit
// can follow and the ones it cannot.
//
// Tracked at the CLIENT ROOT, not at the procedure path. Enumerating the ways a
// procedure can be reached — `useMutation`, a destructured name, an aliased
// namespace, a nested binding pattern — is a blocklist, and three rounds of
// review found a shape each previous list had missed. Everything must pass
// through the object `useTRPC()` returns, so following that object outward is
// complete by construction: a use is readable only when it ends in one of the
// option-builder calls the read-back walk understands, and every other use is an
// escape that makes the procedures under it unresolvable.

import ts from "typescript";

import { propertyChain } from "./expression-resolver.mjs";
import { modules, walk } from "./web-module-graph.mjs";

const CLIENT_FACTORY = "useTRPC";
const READABLE_CALLS = new Set([
  "mutationOptions",
  "queryOptions",
  "infiniteQueryOptions",
]);

// `const trpc = useTRPC()` — the binding every procedure path starts from.
const clientRoots = (module) =>
  walk(module.source, (node) =>
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    ts.isCallExpression(node.initializer) &&
    ts.isIdentifier(node.initializer.expression) &&
    node.initializer.expression.text === CLIENT_FACTORY
      ? [{ name: node.name.text, declaration: node.name }]
      : [],
  );

// Climb out of `root.a.b` to the outermost property access still rooted here.
function outermostAccess(identifier) {
  const climb = (node) =>
    ts.isPropertyAccessExpression(node.parent) &&
    node.parent.expression === node
      ? climb(node.parent)
      : node;
  return climb(identifier);
}

// The path as written, minus the root: `trpc.admin.saveUser` -> "admin.saveUser".
const pathOf = (node) => (propertyChain(node) ?? []).slice(1).join(".");

// Only a RENAME hides a procedure: a destructuring or an assignment to another
// binding gives it a name the chain walk cannot follow back. Handing the client
// to a helper is not a rename — that is how invalidation is written here, and
// the read-back walk already follows the delegation.
const rebinds = (access) =>
  access.parent !== undefined &&
  ts.isVariableDeclaration(access.parent) &&
  access.parent.initializer === access;

// `trpc.a.b.useMutation()` — invoked through a name this analysis does not
// understand, so whatever it does on success is unseen.
const invokedUnreadably = (access) =>
  ts.isPropertyAccessExpression(access) &&
  access.parent !== undefined &&
  ts.isCallExpression(access.parent) &&
  access.parent.expression === access;

// A use is readable only as the callee target of an option builder; the caller
// then owns a described query or mutation the read-back walk can follow.
function classifyUse(identifier, module) {
  // The climb runs through the builder name too, so `trpc.a.b.mutationOptions`
  // is what comes back — the procedure is one level in from there.
  const access = outermostAccess(identifier);
  const builder =
    ts.isPropertyAccessExpression(access) &&
    READABLE_CALLS.has(access.name.text) &&
    access.parent &&
    ts.isCallExpression(access.parent) &&
    access.parent.expression === access
      ? access
      : null;
  if (builder === null) {
    if (invokedUnreadably(access)) {
      // Drop the invoked name: `…attachLead.useMutation` reaches the procedure
      // one level in, and that is the path the verdict is attributed to.
      const prefix = pathOf(access.expression);
      return { kind: "escape", prefix, node: access, module };
    }
    return rebinds(access)
      ? { kind: "escape", prefix: pathOf(access), node: access, module }
      : { kind: "ignored" };
  }
  return builder.name.text === "mutationOptions"
    ? {
        kind: "readable",
        procedure: pathOf(builder.expression),
        call: builder.parent,
        module,
      }
    : { kind: "ignored" };
}

function usesIn(module) {
  const roots = clientRoots(module);
  if (roots.length === 0) return [];
  const names = new Set(roots.map((root) => root.name));
  const declarations = new Set(roots.map((root) => root.declaration));
  return walk(module.source, (node) =>
    ts.isIdentifier(node) && names.has(node.text) && !declarations.has(node)
      ? [classifyUse(node, module)]
      : [],
  );
}

const index = (sites) =>
  sites.reduce(
    (map, site) =>
      map.set(site.procedure, [...(map.get(site.procedure) ?? []), site]),
    new Map(),
  );

const uses = modules().flatMap(usesIn);

export const MUTATION_SITES = index(
  uses.filter((use) => use.kind === "readable"),
);

const escapes = uses.filter((use) => use.kind === "escape");

// An escape at `admin` makes every procedure under `admin` unresolvable, and an
// escape at the bare root makes all of them so — the object left through a door
// this analysis cannot see behind.
export const UNREADABLE_SITES = index(
  [...MUTATION_SITES.keys()].flatMap((procedure) =>
    escapes
      .filter(
        (escape) =>
          escape.prefix === "" ||
          `${procedure}.`.startsWith(`${escape.prefix}.`),
      )
      .map((escape) => ({ ...escape, procedure })),
  ),
);
