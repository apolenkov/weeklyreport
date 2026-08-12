import { describe, expect, it, vi } from "vitest";

import {
  SPECIALIZED_DECLARATIONS,
  type SpecializedDeclaration,
} from "../../matrix/specialized/specialized-declarations.ts";
import { runWithCanonicalReseed } from "./resolver-runner-lifecycle.ts";

const resolverDeclarationFor = (
  id: string,
): Extract<SpecializedDeclaration, { readonly kind: "resolver" }> => {
  const declaration = SPECIALIZED_DECLARATIONS.find(
    (candidate) => candidate.declarationId === id,
  );
  if (declaration?.kind !== "resolver")
    throw new Error(`Missing resolver declaration ${id}`);
  return declaration;
};

describe("viewer status resolver specialized runners", () => {
  it("viewer status empty runs phases then one reseed before cleanup binding", async () => {
    const declaration = resolverDeclarationFor("viewer-status-empty");
    const events: string[] = [];
    const result = await runWithCanonicalReseed<{
      readonly declarationId: string;
      readonly cleanupRef: string | null;
    }>(
      async ({ reseed }) => {
        events.push("phases");
        await reseed();
        events.push("cleanup-ref");
        return Promise.resolve({
          declarationId: declaration.declarationId,
          cleanupRef: null,
        });
      },
      () => {
        events.push("reseed");
        return Promise.resolve();
      },
      (value) => {
        return Promise.resolve({
          ...value,
          cleanupRef: "resolver-cleanup.json",
        });
      },
    );
    expect(declaration).toMatchObject({
      outcome: "empty",
      recoveryOutcome: null,
      executionKind: "navigation",
      faultId: null,
      faultMode: "none",
      resolverOperation: "reports.latestForViewer",
      proof: {
        testFile:
          "e2e/runtime-sweep/scenarios/resolver/resolver-runner.test.ts",
        testName:
          "viewer status empty runs phases then one reseed before cleanup binding",
      },
    });
    expect(events).toEqual(["phases", "reseed", "cleanup-ref"]);
    expect(result.cleanupRef).toBe("resolver-cleanup.json");
  });

  it("viewer status query error declares one fault and an explicit successful recovery", async () => {
    const declaration = resolverDeclarationFor("viewer-status-query-error");
    const events: string[] = [];
    const result = await runWithCanonicalReseed<{
      readonly faultCount: number;
      readonly recoveryOutcome: "visible-current";
      readonly nonMutation: boolean;
    }>(
      async ({ reseed }) => {
        events.push("fault");
        const sentinelsBefore = ["unchanged"];
        const sentinelsAfter = ["unchanged"];
        events.push("retry");
        await reseed();
        return Promise.resolve({
          faultCount: 1,
          recoveryOutcome: "visible-current",
          nonMutation:
            JSON.stringify(sentinelsBefore) === JSON.stringify(sentinelsAfter),
        });
      },
      () => {
        events.push("reseed");
        return Promise.resolve();
      },
      (value) => Promise.resolve(value),
    );
    expect(declaration).toMatchObject({
      outcome: "query-error",
      recoveryOutcome: "visible-current",
      executionKind: "fault",
      faultId: "viewer-status-query-error",
      faultMode: "api-error",
      resolverOperation: "reports.latestForViewer",
      proof: {
        testFile:
          "e2e/runtime-sweep/scenarios/resolver/resolver-runner.test.ts",
        testName:
          "viewer status query error declares one fault and an explicit successful recovery",
      },
    });
    expect(events).toEqual(["fault", "retry", "reseed"]);
    expect(result).toEqual({
      faultCount: 1,
      recoveryOutcome: "visible-current",
      nonMutation: true,
    });
  });

  it("reseeds once after a failed resolver phase without binding cleanup evidence", async () => {
    const events: string[] = [];
    await expect(
      runWithCanonicalReseed(
        async (_lifecycle) => {
          events.push("phases");
          return Promise.reject(new Error("resolver phase failed"));
        },
        () => {
          events.push("reseed");
          return Promise.resolve();
        },
        (value) => {
          events.push("cleanup-ref");
          return Promise.resolve(value);
        },
      ),
    ).rejects.toThrow("resolver phase failed");
    expect(events).toEqual(["phases", "reseed"]);
  });

  it("does not retry a reseed that rejected after partial work", async () => {
    const events: string[] = [];
    const reseed = vi.fn(() => {
      events.push("reseed-partial");
      return Promise.reject(new Error("reseed failed after partial work"));
    });
    const finalize = vi.fn((value: object): Promise<object> =>
      Promise.resolve(value),
    );

    await expect(
      runWithCanonicalReseed(
        async ({ reseed: reseedOnce }) => {
          events.push("phases");
          await reseedOnce();
          return Promise.resolve({ ok: true });
        },
        reseed,
        finalize,
      ),
    ).rejects.toThrow("reseed failed after partial work");

    expect(reseed).toHaveBeenCalledOnce();
    expect(finalize).not.toHaveBeenCalled();
    expect(events).toEqual(["phases", "reseed-partial"]);
  });
});
