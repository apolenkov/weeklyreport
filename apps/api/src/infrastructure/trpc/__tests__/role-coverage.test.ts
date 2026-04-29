import { describe, expect, it } from 'vitest';

import {
  publicProcedure,
  protectedProcedure,
  headProcedure,
  leadProcedure,
  viewerProcedure,
} from '../trpc.middleware.js';
import { createAppRouter } from '../trpc.router.js';

// ---------------------------------------------------------------------------
// AUTH-03 default-deny coverage gate (Phase 27 / Plan 04).
//
// Walks `appRouter._def.procedures` and asserts every leaf procedure was
// constructed via one of the five recognised base procedures:
//   - publicProcedure
//   - protectedProcedure
//   - leadProcedure
//   - headProcedure
//   - viewerProcedure  (adminProcedure === headProcedure for v6.0)
//
// Detection strategy: each tRPC procedure carries `_def.middlewares` — an
// array whose first slot is the shared `loggingMiddleware` reference and
// whose second slot (when present) is the auth/role middleware reference.
// We capture those identities at module init from a starter procedure for
// each base, then assert every router leaf matches one of those identities.
//
// A procedure built directly on `t.procedure` without a recognised base is
// the failure mode the gate fires on. The mutation-test in the second `it()`
// proves the assertion fires for that case.
// ---------------------------------------------------------------------------

// Build dummy resolvers off each base so we can read its middleware-chain
// identities at module init. The resolver function is appended as the last
// middleware, so we slice it off.
const PUBLIC_CHAIN = (publicProcedure.query(() => undefined) as unknown as {
  _def: { middlewares: unknown[] };
})._def.middlewares.slice(0, -1);
const PROTECTED_CHAIN = (protectedProcedure.query(() => undefined) as unknown as {
  _def: { middlewares: unknown[] };
})._def.middlewares.slice(0, -1);
const HEAD_CHAIN = (headProcedure.query(() => undefined) as unknown as {
  _def: { middlewares: unknown[] };
})._def.middlewares.slice(0, -1);
const LEAD_CHAIN = (leadProcedure.query(() => undefined) as unknown as {
  _def: { middlewares: unknown[] };
})._def.middlewares.slice(0, -1);
const VIEWER_CHAIN = (viewerProcedure.query(() => undefined) as unknown as {
  _def: { middlewares: unknown[] };
})._def.middlewares.slice(0, -1);

const ALLOWED_CHAINS: readonly { name: string; chain: readonly unknown[] }[] = [
  { name: 'publicProcedure', chain: PUBLIC_CHAIN },
  { name: 'protectedProcedure', chain: PROTECTED_CHAIN },
  { name: 'headProcedure', chain: HEAD_CHAIN },
  { name: 'leadProcedure', chain: LEAD_CHAIN },
  { name: 'viewerProcedure', chain: VIEWER_CHAIN },
];

/**
 * Assert that a procedure's `_def.middlewares` chain begins with one of the
 * allowed base-procedure middleware-prefix identities. The procedure's own
 * resolver is appended after the chain, so we compare prefix-only.
 */
function isProcedureChainAllowed(middlewares: readonly unknown[]): boolean {
  return ALLOWED_CHAINS.some(({ chain }) => {
    if (middlewares.length < chain.length) return false;
    return chain.every((mw, i) => middlewares[i] === mw);
  });
}

interface LeafProcedure {
  _def: { middlewares: readonly unknown[] };
}

interface RouterRecord {
  [key: string]: LeafProcedure | RouterShape;
}

interface RouterShape {
  _def: { procedures: RouterRecord; record?: RouterRecord };
}

function isLeafProcedure(node: unknown): node is LeafProcedure {
  // tRPC procedures are callable functions that also carry a `_def` property.
  return (
    (typeof node === 'object' || typeof node === 'function') &&
    node !== null &&
    '_def' in node &&
    typeof (node as { _def: unknown })._def === 'object' &&
    (node as { _def: { middlewares?: unknown } })._def.middlewares !== undefined &&
    Array.isArray((node as { _def: { middlewares: unknown } })._def.middlewares)
  );
}

/**
 * Walk a tRPC router's `_def.procedures` (flat record where keys are
 * dot-paths) and the recursive nested-router shape. Returns a list of
 * `[path, leafProcedure]` tuples.
 */
function collectLeafProcedures(
  router: { _def: { procedures: Record<string, unknown>; record?: Record<string, unknown> } },
): Array<[string, LeafProcedure]> {
  const leaves: Array<[string, LeafProcedure]> = [];

  // tRPC v11: `_def.procedures` is a flat record where keys are dot-separated
  // paths into nested namespaces (e.g. 'auth.me', 'reports.getActive'). Each
  // value is a leaf procedure.
  for (const [path, node] of Object.entries(router._def.procedures)) {
    if (isLeafProcedure(node)) {
      leaves.push([path, node]);
    }
  }

  return leaves;
}

/**
 * Pure assertion helper — scans a router and returns the list of offending
 * paths. Empty result means full coverage. Used both for the real AppRouter
 * (must be empty) and the synthetic mutation test (must be non-empty).
 */
export function findUncoveredProcedures(
  router: { _def: { procedures: Record<string, unknown>; record?: Record<string, unknown> } },
): string[] {
  const leaves = collectLeafProcedures(router);
  const offending: string[] = [];

  for (const [path, leaf] of leaves) {
    if (!isProcedureChainAllowed(leaf._def.middlewares)) {
      offending.push(path);
    }
  }

  return offending;
}

describe('AUTH-03 default-deny coverage gate', () => {
  it('every AppRouter leaf procedure uses one of the five recognised role bases', () => {
    // Build the AppRouter with stub deps — we never invoke any procedure here,
    // we only inspect _def.middlewares identity. The deps shape is satisfied
    // by `{}` casts because nothing reads them at construction time.
    const stubDeps = {} as Parameters<typeof createAppRouter>[0];
    const appRouter = createAppRouter(stubDeps);

    const offending = findUncoveredProcedures(
      appRouter as unknown as Parameters<typeof findUncoveredProcedures>[0],
    );

    if (offending.length > 0) {
      // eslint-disable-next-line no-console -- diagnostic surface for CI failures.
      console.error(
        '[AUTH-03] Procedures lacking recognised role declaration:\n' +
          offending.map((p) => `  - ${p}`).join('\n') +
          '\nFix: rebuild on publicProcedure / protectedProcedure / leadProcedure / headProcedure / viewerProcedure.',
      );
    }

    expect(offending).toEqual([]);
  });

  it('mutation test: a procedure built on bare t.procedure triggers the gate', async () => {
    // Construct a synthetic router with one bare procedure to prove the gate
    // fires when role declaration is missing. We import `initTRPC` directly
    // and build a t.procedure unwrapped — no logging, no auth, no role.
    const { initTRPC } = await import('@trpc/server');
    const t = initTRPC.create();

    const bareRouter = t.router({
      naked: t.procedure.query(() => 'no role declared'),
    });

    const offending = findUncoveredProcedures(
      bareRouter as unknown as Parameters<typeof findUncoveredProcedures>[0],
    );

    expect(offending).toContain('naked');
  });

  it('mutation test: an alternate logging-only chain (different instance) also triggers the gate', async () => {
    // Even a procedure that uses a DIFFERENT loggingMiddleware reference
    // must fail — the gate compares middleware-function identity, not
    // shape. This guards against a contributor copy-pasting the logging
    // middleware locally instead of importing the shared base procedures.
    const { initTRPC } = await import('@trpc/server');
    const t = initTRPC.create();

    const fakeLogging = t.middleware(async ({ next }) => next());
    const altPublic = t.procedure.use(fakeLogging);

    const altRouter = t.router({
      lookalike: altPublic.query(() => 'masquerading as public'),
    });

    const offending = findUncoveredProcedures(
      altRouter as unknown as Parameters<typeof findUncoveredProcedures>[0],
    );

    expect(offending).toContain('lookalike');
  });
});
