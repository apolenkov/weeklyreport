import { describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../../../lib/audit-logger.js";
import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import type { TrpcContext } from "../trpc.context.js";
import {
  adminProcedure,
  anyRoleProcedure,
  headProcedure,
  leadershipProcedure,
  leadProcedure,
  loggingMiddleware,
  metricsMiddleware,
  protectedProcedure,
  publicProcedure,
  viewerProcedure,
} from "../trpc.middleware.js";
import { createAppRouter } from "../trpc.router.js";

// Default-deny: every leaf must match one of eight base middleware chains by
// identity. Capture each from a throwaway starter (slice off trailing resolver).
const PUBLIC_CHAIN = (
  publicProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);
const PROTECTED_CHAIN = (
  protectedProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);
const HEAD_CHAIN = (
  headProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);
const ADMIN_CHAIN = (
  adminProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);
const LEAD_CHAIN = (
  leadProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);
const VIEWER_CHAIN = (
  viewerProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);
const ANY_ROLE_CHAIN = (
  anyRoleProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);
const LEADERSHIP_CHAIN = (
  leadershipProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);

const ALLOWED_CHAINS: readonly { name: string; chain: readonly unknown[] }[] = [
  { name: "publicProcedure", chain: PUBLIC_CHAIN },
  { name: "protectedProcedure", chain: PROTECTED_CHAIN },
  { name: "headProcedure", chain: HEAD_CHAIN },
  { name: "adminProcedure", chain: ADMIN_CHAIN },
  { name: "leadProcedure", chain: LEAD_CHAIN },
  { name: "viewerProcedure", chain: VIEWER_CHAIN },
  { name: "anyRoleProcedure", chain: ANY_ROLE_CHAIN },
  { name: "leadershipProcedure", chain: LEADERSHIP_CHAIN },
];

// Per-procedure tRPC plumbing (input/output/resolve) is created fresh and
// cannot match by reference; recognise by name so a renamed tail fails loud
// instead of silently accepting a hand-rolled chain.
const TRPC_PLUMBING_MIDDLEWARE_NAMES = new Set([
  "inputValidatorMiddleware",
  "outputValidatorMiddleware",
  "resolveMiddleware",
]);

function isPlumbingMiddleware(middleware: unknown): boolean {
  return TRPC_PLUMBING_MIDDLEWARE_NAMES.has(
    (middleware as { name?: string } | undefined)?.name ?? "",
  );
}

// Exact base-chain identity, then only tRPC plumbing after — blocks a shorter
// chain (e.g. PUBLIC) matching as a prefix of a longer protected chain.
function isProcedureChainAllowed(middlewares: readonly unknown[]): boolean {
  return ALLOWED_CHAINS.some(
    ({ chain }) =>
      middlewares.length >= chain.length &&
      chain.every((mw, i) => middlewares[i] === mw) &&
      middlewares.slice(chain.length).every(isPlumbingMiddleware),
  );
}

interface LeafProcedure {
  _def: { middlewares: readonly unknown[] };
}

function isLeafProcedure(node: unknown): node is LeafProcedure {
  // tRPC procedures are callable functions that also carry a `_def` property.
  return (
    (typeof node === "object" || typeof node === "function") &&
    node !== null &&
    "_def" in node &&
    typeof node._def === "object" &&
    (node as { _def: { middlewares?: unknown } })._def.middlewares !==
      undefined &&
    Array.isArray((node as { _def: { middlewares: unknown } })._def.middlewares)
  );
}

function collectLeafProcedures(router: {
  _def: {
    procedures: Record<string, unknown>;
    record?: Record<string, unknown>;
  };
}): [string, LeafProcedure][] {
  const leaves: [string, LeafProcedure][] = [];

  for (const [path, node] of Object.entries(router._def.procedures)) {
    if (isLeafProcedure(node)) {
      leaves.push([path, node]);
    }
  }

  return leaves;
}

function findUncoveredProcedures(router: {
  _def: {
    procedures: Record<string, unknown>;
    record?: Record<string, unknown>;
  };
}): string[] {
  const leaves = collectLeafProcedures(router);
  const offending: string[] = [];

  for (const [path, leaf] of leaves) {
    if (!isProcedureChainAllowed(leaf._def.middlewares)) {
      offending.push(path);
    }
  }

  return offending;
}

describe("default-deny coverage gate", () => {
  it("every AppRouter leaf procedure uses one of the eight recognised role bases", () => {
    // Build the AppRouter with stub deps — we never invoke any procedure here,
    // we only inspect _def.middlewares identity. The deps shape is satisfied
    // by `{}` casts because nothing reads them at construction time.
    const stubDeps = {} as Parameters<typeof createAppRouter>[0];
    const appRouter = createAppRouter(stubDeps);

    const offending = findUncoveredProcedures(appRouter);

    if (offending.length > 0) {
      // Diagnostic surface for CI failures; the assertion below fails the test.
      console.error(
        `Procedures lacking recognised role declaration:\n${offending
          .map((p) => `  - ${p}`)
          .join(
            "\n",
          )}\nFix: rebuild on publicProcedure / protectedProcedure / leadProcedure / headProcedure / viewerProcedure / adminProcedure / anyRoleProcedure / leadershipProcedure.`,
      );
    }

    expect(offending).toEqual([]);
  });

  it("mutation test: a procedure built on bare t.procedure triggers the gate", async () => {
    // Construct a synthetic router with one bare procedure to prove the gate
    // fires when role declaration is missing. We import `initTRPC` directly
    // and build a t.procedure unwrapped — no logging, no auth, no role.
    const { initTRPC } = await import("@trpc/server");
    const t = initTRPC.create();

    const bareRouter = t.router({
      naked: t.procedure.query(() => "no role declared"),
    });

    const offending = findUncoveredProcedures(bareRouter);

    expect(offending).toContain("naked");
  });

  it("mutation test: an alternate logging-only chain (different instance) also triggers the gate", async () => {
    // Even a procedure that uses a DIFFERENT loggingMiddleware reference
    // must fail — the gate compares middleware-function identity, not
    // shape. This guards against a contributor copy-pasting the logging
    // middleware locally instead of importing the shared base procedures.
    const { initTRPC } = await import("@trpc/server");
    const t = initTRPC.create();

    const fakeLogging = t.middleware(async ({ next }) => next());
    const altPublic = t.procedure.use(fakeLogging);

    const altRouter = t.router({
      lookalike: altPublic.query(() => "masquerading as public"),
    });

    const offending = findUncoveredProcedures(altRouter);

    expect(offending).toContain("lookalike");
  });

  it("mutation test: a chain reusing the real metrics+logging prefix with a fake role middleware also triggers the gate", async () => {
    // This is the case an inequality-tolerant prefix match misses: the chain
    // starts with the REAL shared metricsMiddleware + loggingMiddleware pair
    // (same references PUBLIC_CHAIN is built from), so a `.some()` prefix
    // check matches PUBLIC_CHAIN without ever looking at slot 2 — the
    // hand-rolled role middleware never gets inspected.
    const { initTRPC } = await import("@trpc/server");
    // Context must match TrpcContext — the real metricsMiddleware /
    // loggingMiddleware are typed against it and won't attach to a bare
    // `initTRPC.create()` procedure.
    const t = initTRPC.context<TrpcContext>().create();

    const fakeRoleMiddleware = t.middleware(({ next }) => next());
    const handRolled = t.procedure
      .use(metricsMiddleware)
      .use(loggingMiddleware)
      .use(fakeRoleMiddleware);

    const handRolledRouter = t.router({
      impersonator: handRolled.query(() => "reuses the real shared prefix"),
    });

    const offending = findUncoveredProcedures(handRolledRouter);

    expect(offending).toContain("impersonator");
  });
});

// pdfExport is leadershipProcedure (head+admin+viewer); lead is the data
// subject, not an exporter. Assert exact leadership chain (not anyRole — the
// coverage gate accepts both) and FORBIDDEN for lead (not bare reject).

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

function leadContext(): TrpcContext {
  return {
    session: {
      userId: "lead-1",
      email: "lead@test.com",
      name: "Lead User",
      role: "lead",
      activeReportId: "r1",
      activeReportSectionId: "s1",
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "127.0.0.1",
    isPdfExport: false,
    pdfReportId: null,
  };
}

describe("pdfExport authz: leadership chain, lead excluded", () => {
  const stubDeps = {} as Parameters<typeof createAppRouter>[0];
  const appRouter = createAppRouter(stubDeps);
  const procedures = appRouter._def.procedures as unknown as Record<
    string,
    { _def: { middlewares: readonly unknown[] } }
  >;

  // Compare base-chain prefix: leadership vs anyRole differ only at the role
  // middleware slot after shared metrics/logging.
  function startsWithChain(
    middlewares: readonly unknown[],
    base: readonly unknown[],
  ): boolean {
    return base.every((mw, i) => middlewares[i] === mw);
  }

  it("pdfExport.request uses the leadership chain (head+admin+viewer), not anyRole", () => {
    const chain = expectDefined(procedures["pdfExport.request"])._def
      .middlewares;
    expect(startsWithChain(chain, LEADERSHIP_CHAIN)).toBe(true);
    expect(startsWithChain(chain, ANY_ROLE_CHAIN)).toBe(false);
  });

  it("pdfExport.status uses the leadership chain (head+admin+viewer), not anyRole", () => {
    const chain = expectDefined(procedures["pdfExport.status"])._def
      .middlewares;
    expect(startsWithChain(chain, LEADERSHIP_CHAIN)).toBe(true);
    expect(startsWithChain(chain, ANY_ROLE_CHAIN)).toBe(false);
  });

  it("lead session is FORBIDDEN from pdfExport.request", async () => {
    const caller = appRouter.createCaller(leadContext());
    await expect(
      caller.pdfExport.request({ reportId: VALID_UUID }),
    ).rejects.toMatchObject(
      expect.objectContaining({ code: "FORBIDDEN" }) as Record<string, unknown>,
    );
  });

  it("lead session is FORBIDDEN from pdfExport.status", async () => {
    const caller = appRouter.createCaller(leadContext());
    await expect(
      caller.pdfExport.status({ jobId: VALID_UUID }),
    ).rejects.toMatchObject(
      expect.objectContaining({ code: "FORBIDDEN" }) as Record<string, unknown>,
    );
  });
});
