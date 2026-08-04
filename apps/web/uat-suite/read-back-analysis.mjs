// Does the user see the result? A mutation counts as read back only when its
// success path reaches one: a cache invalidation naming a real query, or a full
// page navigation. Sibling query names prove nothing and are not consulted.
//
// Every step the resolver cannot follow (a callback handed in as a parameter, a
// key built somewhere else) is reported as such — never assumed to be empty.

import path from "node:path";

import ts from "typescript";

import {
  memberOf,
  propertyChain,
  queryPathOf,
  resolveExpr,
  resolveFunction,
  resolveObject,
  rootIdentifier,
} from "./expression-resolver.mjs";
import { MUTATION_SITES, UNREADABLE_SITES } from "./mutation-call-sites.mjs";
import { isLibraryName, walk, WEB_SRC } from "./web-module-graph.mjs";

const INVALIDATORS = new Set([
  "invalidateQueries",
  "refetchQueries",
  "resetQueries",
  "setQueryData",
]);
// onSettled counts: reopen-requests-card refreshes there so a race still drops
// the stale row, and that is a read-back on the success path too.
const SUCCESS_HANDLERS = ["onSuccess", "onSettled"];
const LOCATION_OPERATIONS = new Set(["reload", "assign", "replace"]);
// Helper calls followed out of a handler body: invalidateReportViews →
// invalidateDashboard is already two, so a couple of spare levels.
const MAX_DELEGATION = 4;

const evidence = (detail) => ({ kind: "evidence", detail });
const opaque = (detail) => ({ kind: "opaque", detail });

const isLocationHref = ([root, second, third]) =>
  (root === "location" && second === "href" && third === undefined) ||
  (root === "window" && second === "location" && third === "href");

const locationOperation = ([root, second, third]) => {
  if (root === "location" && third === undefined) return second;
  return root === "window" && second === "location" ? third : undefined;
};

export function navigationKind(chain, rootKind, assignment) {
  const isGlobal = rootKind === "global";
  if (isGlobal && assignment && isLocationHref(chain)) {
    return "location.href";
  }
  const operation = locationOperation(chain);
  if (isGlobal && !assignment && LOCATION_OPERATIONS.has(operation))
    return `location.${operation}`;
  const [, second] = chain;
  return rootKind === "next-router" &&
    !assignment &&
    chain.length === 2 &&
    second === "refresh"
    ? "router.refresh"
    : null;
}

const navigationTarget = (node) => {
  const isAssignment =
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  const target = isAssignment
    ? node.left
    : ts.isCallExpression(node)
      ? node.expression
      : null;
  return { assignment: isAssignment, target };
};

const navigationRootKind = (target, ctx) => {
  const root = rootIdentifier(target);
  const resolved = root === null ? null : resolveExpr(root, ctx.module, 0);
  if (resolved === null) return "global";
  if (!ts.isCallExpression(resolved.node)) return "local";
  return propertyChain(resolved.node.expression)?.at(-1) === "useRouter"
    ? "next-router"
    : "local";
};

function navigationEvidence(node, ctx) {
  const { assignment, target } = navigationTarget(node);
  if (target === null) return null;
  const chain = propertyChain(target);
  const hit =
    chain && navigationKind(chain, navigationRootKind(target, ctx), assignment);
  return hit ? evidence(`full page navigation (${hit})`) : null;
}

function invalidationFindings(call, ctx) {
  const callee = call.expression;
  const isInvalidator =
    ts.isPropertyAccessExpression(callee) && INVALIDATORS.has(callee.name.text);
  if (!isInvalidator) return null;
  const paths = call.arguments.flatMap((argument) =>
    walk(argument, (node) => {
      const queryPath = queryPathOf(node);
      return queryPath && ctx.queries.has(queryPath) ? [queryPath] : [];
    }),
  );
  if (paths.length > 0) {
    return paths.map((queryPath) =>
      evidence(`${callee.name.text}(${queryPath})`),
    );
  }
  return [opaque(`${callee.name.text}() names no known query`)];
}

// A call we cannot resolve is only worth reporting when it could have carried a
// read-back. A library call could not, and neither could a method on a value
// that is not a bag of callbacks — those are noise, not blind spots.
function unfollowableFindings(call, ctx) {
  const callee = call.expression;
  const root = rootIdentifier(callee);
  if (!root || isLibraryName(root.text, ctx.module)) return [];
  const label = propertyChain(callee)?.join(".") ?? root.text;
  if (ts.isIdentifier(callee)) return [opaque(`cannot follow ${label}()`)];
  const owner = resolveExpr(callee.expression, ctx.module, 0);
  const isCallbackBag = owner && ts.isObjectLiteralExpression(owner.node);
  return isCallbackBag ? [opaque(`cannot follow ${label}()`)] : [];
}

function delegationFindings(call, ctx) {
  if (ctx.depth >= MAX_DELEGATION) {
    return [opaque(`delegation deeper than ${MAX_DELEGATION} calls`)];
  }
  const target = resolveFunction(call.expression, ctx.module, 0);
  if (!target) return unfollowableFindings(call, ctx);
  if (ctx.seen.has(target.node)) return [];
  return scanFunction(target.node, {
    ...ctx,
    module: target.module,
    depth: ctx.depth + 1,
    seen: new Set([...ctx.seen, target.node]),
  });
}

function nodeFindings(node, ctx) {
  const navigation = navigationEvidence(node, ctx);
  if (navigation) return [navigation];
  if (!ts.isCallExpression(node)) return [];
  return invalidationFindings(node, ctx) ?? delegationFindings(node, ctx);
}

function scanFunction(fn, ctx) {
  return walk(fn.body ?? fn, (node) => nodeFindings(node, ctx));
}

const unique = (details) => [...new Set(details)].join(", ");

function verdictOf(findings) {
  const proofs = findings.filter((finding) => finding.kind === "evidence");
  if (proofs.length > 0) {
    return { status: "verified", detail: unique(proofs.map((p) => p.detail)) };
  }
  const blind = findings.filter((finding) => finding.kind === "opaque");
  if (blind.length > 0) {
    return { status: "unresolved", detail: unique(blind.map((b) => b.detail)) };
  }
  return { status: "partial", detail: "success handler runs no read-back" };
}

function auditSite(site, queries) {
  const where = path.relative(WEB_SRC, site.module.file);
  const options = resolveObject(site.call.arguments[0], site.module, 0);
  if (!options) {
    return { where, status: "unresolved", detail: "options are not a literal" };
  }
  // A handler that is absent and a handler that cannot be followed are
  // different answers: only the first one is a definite gap.
  const present = SUCCESS_HANDLERS.map((name) =>
    memberOf(options.node, name),
  ).filter(Boolean);
  if (present.length === 0) {
    return { where, status: "partial", detail: "no success handler" };
  }
  const handlers = present
    .map((handler) => resolveFunction(handler, options.module, 0))
    .filter(Boolean);
  const ctx = { queries, depth: 0, seen: new Set() };
  const findings = [
    ...handlers.flatMap((handler) =>
      scanFunction(handler.node, { ...ctx, module: handler.module }),
    ),
    ...(handlers.length < present.length
      ? [opaque("a success handler could not be followed")]
      : []),
  ];
  return { where, ...verdictOf(findings) };
}

// A definite gap outranks an unknown one: PARTIAL is the actionable verdict, so
// it wins over UNRESOLVED when call sites of one mutation disagree.
function worstOf(sites) {
  const gap = sites.find((site) => site.status === "partial");
  const blind = sites.find((site) => site.status === "unresolved");
  const worst = gap ?? blind;
  if (!worst)
    return { status: "VERIFIED", detail: unique(sites.map((s) => s.detail)) };
  return {
    status: worst === gap ? "PARTIAL" : "UNRESOLVED",
    detail: `${worst.where}: ${worst.detail}`,
  };
}

// VERIFIED / PARTIAL / UNRESOLVED for one mutation, with the evidence or the
// reason it is missing, over every call site the web app has.
export function auditReadBack(procedure, queries) {
  const sites = MUTATION_SITES.get(procedure) ?? [];
  const unreadable = UNREADABLE_SITES.get(procedure) ?? [];
  // One call site this analysis cannot follow makes the verdict for ALL of them
  // unknown: a clean success path elsewhere says nothing about the one that was
  // never read.
  if (unreadable.length > 0) {
    const where = unreadable
      .map((site) => path.relative(WEB_SRC, site.module.file))
      .join(", ");
    return {
      status: "UNRESOLVED",
      callSites: sites.length + unreadable.length,
      detail: `call style this audit cannot follow in ${where}`,
    };
  }
  if (sites.length === 0) {
    return {
      status: "UNRESOLVED",
      callSites: 0,
      detail: "no `.mutationOptions(` call site found",
    };
  }
  const audited = sites.map((site) => auditSite(site, queries));
  return { callSites: sites.length, ...worstOf(audited) };
}
