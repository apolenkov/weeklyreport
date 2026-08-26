import { describe, expect, it } from "vitest";

import {
  type RevealCanaryLifecycle,
  settleControllerAfterParentExit,
  settleControllerAfterParentFailure,
} from "./preflight-reveal-host-checkpoint-lifecycle.ts";

const abortErrorCausedBy = (cause: unknown): Error => {
  const error = new Error("controller aborted", { cause });
  error.name = "AbortError";
  return error;
};

describe("exact admin/demo reveal canary lifecycle settlement", () => {
  it("collapses a controller AbortError derived from the parent failure", async () => {
    const primary = new Error("parent failed");
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller: Promise.resolve({ error: abortErrorCausedBy(primary) }),
      abort: () => undefined,
      close: () => undefined,
    };

    await expect(
      settleControllerAfterParentFailure(lifecycle, primary),
    ).rejects.toBe(primary);
  });

  it.each([
    ["without a cause", new Error("controller aborted")],
    ["with a different cause", abortErrorCausedBy(new Error("other"))],
  ])("preserves an independent AbortError %s", async (_label, error) => {
    error.name = "AbortError";
    const primary = new Error("parent failed");
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller: Promise.resolve({ error }),
      abort: () => undefined,
      close: () => undefined,
    };

    const failure = await settleControllerAfterParentFailure(
      lifecycle,
      primary,
    ).catch((error_: unknown) => error_);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([primary, error]);
  });

  it("does not collapse an unrelated error with the same message", async () => {
    const primary = new Error("same message");
    const controllerFailure = new Error("same message");
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller: Promise.resolve({ error: controllerFailure }),
      abort: () => undefined,
      close: () => undefined,
    };

    const failure = await settleControllerAfterParentFailure(
      lifecycle,
      primary,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      primary,
      controllerFailure,
    ]);
  });

  it("requires reference identity for a caused AbortError", async () => {
    const primary = "parent failed";
    const controllerFailure = abortErrorCausedBy(primary);
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller: Promise.resolve({ error: controllerFailure }),
      abort: () => undefined,
      close: () => undefined,
    };

    const failure = await settleControllerAfterParentFailure(
      lifecycle,
      primary,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      primary,
      controllerFailure,
    ]);
  });

  it("does not collapse equal primitive rejection reasons", async () => {
    const primary = "parent failed";
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller: Promise.resolve({ error: primary }),
      abort: () => undefined,
      close: () => undefined,
    };

    const failure = await settleControllerAfterParentFailure(
      lifecycle,
      primary,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([primary, primary]);
  });

  it("collapses a controller AbortError derived from a nonzero parent exit", async () => {
    let resolveController:
      ((outcome: Readonly<{ readonly error: unknown }>) => void) | undefined;
    const controller = new Promise<Readonly<{ readonly error: unknown }>>(
      (resolve) => {
        resolveController = resolve;
      },
    );
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller,
      abort: (reason) =>
        resolveController?.({ error: abortErrorCausedBy(reason) }),
      close: () => undefined,
    };

    await expect(
      settleControllerAfterParentExit(lifecycle, 23),
    ).resolves.toBeUndefined();
  });

  it("preserves an independent AbortError after a nonzero parent exit", async () => {
    const controllerFailure = abortErrorCausedBy(new Error("other"));
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller: Promise.resolve({ error: controllerFailure }),
      abort: () => undefined,
      close: () => undefined,
    };

    const failure = await settleControllerAfterParentExit(lifecycle, 23).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors[1]).toBe(controllerFailure);
  });

  it("preserves a thrown parent failure with a nonzero controller exit", async () => {
    const primary = new Error("parent failed");
    const lifecycle: RevealCanaryLifecycle = {
      signal: new AbortController().signal,
      deadlineAt: 0,
      deadlineMonotonic: 0,
      monotonicNow: () => 0,
      controller: Promise.resolve({ code: 19 }),
      abort: () => undefined,
      close: () => undefined,
    };
    const failure = await settleControllerAfterParentFailure(
      lifecycle,
      primary,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(
      (failure as AggregateError).errors.map((error) =>
        error instanceof Error ? error.message : String(error),
      ),
    ).toEqual([
      "parent failed",
      "Host checkpoint controller exited with code 19",
    ]);
  });
});
