import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeadFormGeneration } from "./lead-form-generation";
import type { LeadFormWritePort } from "./lead-form-write-port";
import { useLeadFormRevoke } from "./use-lead-form-revoke";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const GENERATION_A = "report-a:section-a" as LeadFormGeneration;
const GENERATION_B = "report-b:section-b" as LeadFormGeneration;

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: Error) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function makeWritePort(revoke: LeadFormWritePort["revoke"]): LeadFormWritePort {
  return {
    pending: {
      saveDraft: false,
      submit: false,
      resolvePlan: false,
      restorePlan: false,
      promotePlan: false,
      fillFrom: false,
      revoke: false,
      reopen: false,
    },
    saveDraft: vi.fn<LeadFormWritePort["saveDraft"]>(),
    submit: vi.fn<LeadFormWritePort["submit"]>(),
    resolvePlan: vi.fn<LeadFormWritePort["resolvePlan"]>(),
    restorePlan: vi.fn<LeadFormWritePort["restorePlan"]>(),
    promotePlan: vi.fn<LeadFormWritePort["promotePlan"]>(),
    fillFrom: vi.fn<LeadFormWritePort["fillFrom"]>(),
    revoke,
    requestReopen: vi.fn<LeadFormWritePort["requestReopen"]>(),
  };
}

function mountRevoke(revoke: LeadFormWritePort["revoke"]) {
  const onRevoked = vi.fn();
  const writePort = makeWritePort(revoke);
  const rendered = renderHook(
    ({ generation, sectionIdForActions }) =>
      useLeadFormRevoke({
        generation,
        sectionIdForActions,
        onRevoked,
        writePort,
      }),
    {
      initialProps: {
        generation: GENERATION_A,
        sectionIdForActions: "section-a",
      },
    },
  );
  return { ...rendered, onRevoked };
}

async function settle(
  pending: Deferred<{ readonly success: true }>,
  completion: "success" | "error",
) {
  await act(async () => {
    if (completion === "success") {
      pending.resolve({ success: true });
    } else {
      pending.reject(new Error("Revoke A failed"));
    }
    await pending.promise.catch(() => undefined);
  });
}

describe("useLeadFormRevoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["success", "error"] as const)(
    "keeps the current activation's %s announcement",
    async (completion) => {
      const pending = deferred<{ readonly success: true }>();
      const revoke = vi.fn<LeadFormWritePort["revoke"]>(() => pending.promise);
      const harness = mountRevoke(revoke);

      act(() => harness.result.current.confirmRevoke());
      await settle(pending, completion);

      expect(revoke).toHaveBeenCalledExactlyOnceWith({
        reportSectionId: "section-a",
      });
      if (completion === "success") {
        expect(harness.onRevoked).toHaveBeenCalledOnce();
        expect(toast.success).toHaveBeenCalledExactlyOnceWith(
          "Section unlocked",
        );
        expect(toast.error).not.toHaveBeenCalled();
      } else {
        expect(harness.onRevoked).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledExactlyOnceWith("Revoke A failed");
      }
    },
  );

  it("names the action for a bare transport failure instead of showing it raw", async () => {
    const pending = deferred<{ readonly success: true }>();
    const revoke = vi.fn<LeadFormWritePort["revoke"]>(() => pending.promise);
    const harness = mountRevoke(revoke);

    act(() => harness.result.current.confirmRevoke());
    await act(async () => {
      pending.reject(new Error("Failed to fetch"));
      await pending.promise.catch(() => undefined);
    });

    expect(harness.onRevoked).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Revoke failed");
  });

  it.each([
    { route: "A to B", completion: "success" },
    { route: "A to B", completion: "error" },
    { route: "A to B to A", completion: "success" },
    { route: "A to B to A", completion: "error" },
  ] as const)(
    "suppresses an old activation's $completion effects after $route",
    async ({ route, completion }) => {
      const pending = deferred<{ readonly success: true }>();
      const revoke = vi.fn<LeadFormWritePort["revoke"]>(() => pending.promise);
      const harness = mountRevoke(revoke);

      act(() => harness.result.current.confirmRevoke());
      harness.rerender({
        generation: GENERATION_B,
        sectionIdForActions: "section-b",
      });
      if (route === "A to B to A") {
        harness.rerender({
          generation: GENERATION_A,
          sectionIdForActions: "section-a",
        });
      }
      await settle(pending, completion);

      expect(revoke).toHaveBeenCalledExactlyOnceWith({
        reportSectionId: "section-a",
      });
      expect(harness.onRevoked).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );
});
