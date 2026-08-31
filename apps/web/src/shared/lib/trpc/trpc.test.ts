import { TRPCClientError, type TRPCClientRuntime } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginSessionTransition } from "../auth/session-transition";
import {
  createAuthRedirectHandler,
  createAuthRedirectLink,
  createSessionTransitionLink,
  isConflictError,
} from "./trpc";

// ---------------------------------------------------------------------------
// Helpers — build a fake TRPCClientError with the desired httpStatus.
// ---------------------------------------------------------------------------

function makeUnauthorizedError(): TRPCClientError<never> {
  const err = new TRPCClientError<never>("UNAUTHORIZED");
  // The `data` property is read by the link to determine the HTTP status.
  Object.defineProperty(err, "data", {
    value: { httpStatus: 401, code: "UNAUTHORIZED" },
    configurable: true,
  });
  return err;
}

function makeServerError(): TRPCClientError<never> {
  const err = new TRPCClientError<never>("INTERNAL_SERVER_ERROR");
  Object.defineProperty(err, "data", {
    value: { httpStatus: 500, code: "INTERNAL_SERVER_ERROR" },
    configurable: true,
  });
  return err;
}

// ---------------------------------------------------------------------------
// window.location stubs
// ---------------------------------------------------------------------------

let assignSpy: ReturnType<typeof vi.fn>;

function stubLocation(pathname: string, search = "") {
  assignSpy = vi.fn();
  const fakeLocation = {
    pathname,
    search,
    href: `http://localhost:3000${pathname}${search}`,
    assign: assignSpy,
  };
  vi.stubGlobal("window", { location: fakeLocation });
}

beforeEach(() => {
  assignSpy = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests for the auth-redirect handler — pure function, no observable
// machinery required to validate the redirect logic.
// ---------------------------------------------------------------------------

describe("createAuthRedirectHandler — 401 interceptor logic", () => {
  it("redirects to /?next=<encoded-path> on 401 from a protected page", () => {
    stubLocation("/lead/report");
    const handled = createAuthRedirectHandler()(makeUnauthorizedError());
    expect(handled).toBe(true);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith("/?next=%2Flead%2Freport");
  });

  it("preserves query string in the next= parameter", () => {
    stubLocation("/lead/report", "?mode=slides");
    createAuthRedirectHandler()(makeUnauthorizedError());
    expect(assignSpy).toHaveBeenCalledWith(
      "/?next=%2Flead%2Freport%3Fmode%3Dslides",
    );
  });

  it("does not redirect when already on / (login page)", () => {
    stubLocation("/");
    const handled = createAuthRedirectHandler()(makeUnauthorizedError());
    expect(handled).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("does not redirect when on /auth/error", () => {
    stubLocation("/auth/error");
    const handled = createAuthRedirectHandler()(makeUnauthorizedError());
    expect(handled).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("does not redirect on non-401 errors", () => {
    stubLocation("/lead/report");
    const handled = createAuthRedirectHandler()(makeServerError());
    expect(handled).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("does not redirect on plain Error objects (non-TRPCClientError)", () => {
    stubLocation("/lead/report");
    const handled = createAuthRedirectHandler()(new Error("boom"));
    expect(handled).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("lets the explicit session transition own navigation on a late 401", () => {
    stubLocation("/head/dashboard");
    const transition = beginSessionTransition();
    expect(transition).not.toBeNull();

    const handled = createAuthRedirectHandler()(makeUnauthorizedError());

    expect(handled).toBe(true);
    expect(assignSpy).not.toHaveBeenCalled();
    transition?.finish();
  });
});

// ---------------------------------------------------------------------------
// Tests for createAuthRedirectLink — observable seam.
//
// Build the link via createAuthRedirectLink()({}) (TRPCClientRuntime is {}
// in v11). Stub upstream `next` with observable() from @trpc/server/observable.
// Subscribe with vi.fn() next/error/complete spies.
// ---------------------------------------------------------------------------

// Minimal operation stub; the link only reads path for stubbing.
function makeOperation() {
  return {
    id: 1,
    type: "query" as const,
    input: undefined,
    path: "lead.report",
    context: {},
    signal: null,
  };
}

interface SpySet {
  next: ReturnType<typeof vi.fn<(value: unknown) => void>>;
  error: ReturnType<typeof vi.fn<(err: unknown) => void>>;
  complete: ReturnType<typeof vi.fn<() => void>>;
}

// Exercise the auth-redirect link against a real upstream observable; v11's
// empty runtime object satisfies TRPCClientRuntime without a cast.
function runLink(upstream: ReturnType<typeof observable>, spies: SpySet): void {
  const runtime: TRPCClientRuntime = {};
  const opLink = createAuthRedirectLink()(runtime);
  opLink({ next: () => upstream, op: makeOperation() }).subscribe(spies);
}

describe("createAuthRedirectLink — observable seam", () => {
  it("401 from /lead/report → assignSpy called once, errorSpy NOT called, completeSpy NOT called", () => {
    stubLocation("/lead/report");
    const spies: SpySet = { next: vi.fn(), error: vi.fn(), complete: vi.fn() };
    const err401 = makeUnauthorizedError();

    runLink(
      observable((obs) => {
        obs.error(err401);
      }),
      spies,
    );

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith("/?next=%2Flead%2Freport");
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.complete).not.toHaveBeenCalled();
  });

  it("500 error → errorSpy called once with the same error instance, no redirect", () => {
    stubLocation("/lead/report");
    const spies: SpySet = { next: vi.fn(), error: vi.fn(), complete: vi.fn() };
    const err500 = makeServerError();

    runLink(
      observable((obs) => {
        obs.error(err500);
      }),
      spies,
    );

    expect(assignSpy).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledTimes(1);
    expect(spies.error).toHaveBeenCalledWith(err500);
    expect(spies.complete).not.toHaveBeenCalled();
  });

  it("result envelope then complete → nextSpy receives the envelope, completeSpy fires once, errorSpy never", () => {
    stubLocation("/lead/report");
    const spies: SpySet = { next: vi.fn(), error: vi.fn(), complete: vi.fn() };
    const envelope = { result: { data: { ok: true } } };

    runLink(
      observable((obs) => {
        obs.next(envelope);
        obs.complete();
      }),
      spies,
    );

    expect(spies.next).toHaveBeenCalledTimes(1);
    expect(spies.next).toHaveBeenCalledWith(envelope);
    expect(spies.complete).toHaveBeenCalledTimes(1);
    expect(spies.error).not.toHaveBeenCalled();
  });
});

describe("createSessionTransitionLink — observable seam", () => {
  it("holds new operations until a failed transition releases the page", () => {
    const transition = beginSessionTransition();
    expect(transition).not.toBeNull();
    const upstreamSubscribed = vi.fn();
    const spies: SpySet = {
      next: vi.fn(),
      error: vi.fn(),
      complete: vi.fn(),
    };
    const runtime: TRPCClientRuntime = {};
    const opLink = createSessionTransitionLink()(runtime);
    const source = observable<{ result: { data: string } }>((observer) => {
      upstreamSubscribed();
      observer.next({ result: { data: "ready" } });
      observer.complete();
    });

    opLink({ next: () => source, op: makeOperation() }).subscribe(spies);
    expect(upstreamSubscribed).not.toHaveBeenCalled();

    transition?.finish();
    expect(upstreamSubscribed).toHaveBeenCalledOnce();
    expect(spies.next).toHaveBeenCalledWith({ result: { data: "ready" } });
    expect(spies.complete).toHaveBeenCalledOnce();
  });

  it("drops a canceled waiter instead of sending it after release", () => {
    const transition = beginSessionTransition();
    expect(transition).not.toBeNull();
    const upstreamSubscribed = vi.fn();
    const runtime: TRPCClientRuntime = {};
    const opLink = createSessionTransitionLink()(runtime);
    const source = observable((observer) => {
      upstreamSubscribed();
      observer.complete();
    });

    const subscription = opLink({
      next: () => source,
      op: makeOperation(),
    }).subscribe({});
    subscription.unsubscribe();
    transition?.finish();

    expect(upstreamSubscribed).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// isConflictError — optimistic-lock 409 detection
// ---------------------------------------------------------------------------

function makeConflictError(
  data: { code?: string; httpStatus?: number } = { code: "CONFLICT" },
): TRPCClientError<never> {
  const err = new TRPCClientError<never>("stale");
  Object.defineProperty(err, "data", { value: data, configurable: true });
  return err;
}

describe("isConflictError", () => {
  it("is true for a tRPC CONFLICT code", () => {
    expect(isConflictError(makeConflictError({ code: "CONFLICT" }))).toBe(true);
  });

  it("is true for HTTP 409 even without the code", () => {
    expect(isConflictError(makeConflictError({ httpStatus: 409 }))).toBe(true);
  });

  it("is false for other tRPC error codes", () => {
    expect(isConflictError(makeConflictError({ code: "BAD_REQUEST" }))).toBe(
      false,
    );
  });

  it("is false for plain Errors and non-error values", () => {
    expect(isConflictError(new Error("conflict"))).toBe(false);
    expect(isConflictError(null)).toBe(false);
    expect(isConflictError({ data: { code: "CONFLICT" } })).toBe(false);
  });
});
