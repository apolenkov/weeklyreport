import { describe, expect, it } from "vitest";

import { stableSerialize } from "../../support/ids.ts";
import {
  createPreflightStateSelector,
  type PreflightStateSelector,
  preflightStateSemanticSelectorSchema,
  resolvePreflightStateBySemantics,
  resolvePreflightStateSelector,
} from "./preflight-state.ts";
import {
  canonicalAxisMutations,
  otherRole,
  withSelectorDigest,
  withSource,
} from "./preflight-state-test-support.ts";

describe("exact preflight state selector", () => {
  it("creates and resolves one complete source/state/route identity", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selector = createPreflightStateSelector({ source, state });
      expect(selector).toMatchObject({
        sourceSha: source.sourceSha,
        sourceTree: source.sourceTree,
        treeDigest: source.treeDigest,
        sourceDigest: source.sourceDigest,
        planDigest: source.plan.digest,
        stateId: state.stateId,
        profile: state.profile,
        axes: state.axes,
      });
      expect(selector.stateDigest).toHaveLength(64);
      expect(selector.role).toBe(state.axes.role);
      expect(selector.catalogRoute).toMatch(/^\//u);
      expect(selector.resolvedRoute).toMatch(/^\//u);
      const resolved = resolvePreflightStateSelector({
        source,
        selector,
      });
      expect(resolved.state).toEqual(state);
      expect(stableSerialize(resolved.selector)).toBe(
        stableSerialize(selector),
      );
    });
  });

  it("rejects selector-by-stateId-only and role/route/profile-only selectors", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selector = createPreflightStateSelector({ source, state });
      expect(() =>
        resolvePreflightStateSelector({
          source,
          selector: { stateId: state.stateId },
        }),
      ).toThrow("Invalid preflight state selector");
      expect(() =>
        resolvePreflightStateSelector({
          source,
          selector: {
            role: selector.role,
            catalogRoute: selector.catalogRoute,
            resolvedRoute: selector.resolvedRoute,
          },
        }),
      ).toThrow("Invalid preflight state selector");
      expect(() =>
        resolvePreflightStateSelector({
          source,
          selector: {
            profile: selector.profile,
            role: selector.role,
            catalogRoute: selector.catalogRoute,
            resolvedRoute: selector.resolvedRoute,
          },
        }),
      ).toThrow("Invalid preflight state selector");
    });
  });

  it("rejects every source, state, axis, profile, and route mismatch", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selector = createPreflightStateSelector({ source, state });
      const mismatches: readonly [string, Partial<PreflightStateSelector>][] = [
        [
          "source SHA",
          {
            sourceSha:
              selector.sourceSha === "a".repeat(40)
                ? "b".repeat(40)
                : "a".repeat(40),
          },
        ],
        [
          "source tree",
          {
            sourceTree:
              selector.sourceTree === "b".repeat(40)
                ? "c".repeat(40)
                : "b".repeat(40),
          },
        ],
        [
          "tree digest",
          {
            treeDigest:
              selector.treeDigest === "c".repeat(64)
                ? "d".repeat(64)
                : "c".repeat(64),
          },
        ],
        [
          "source digest",
          {
            sourceDigest:
              selector.sourceDigest === "d".repeat(64)
                ? "e".repeat(64)
                : "d".repeat(64),
          },
        ],
        [
          "plan digest",
          {
            planDigest:
              selector.planDigest === "e".repeat(64)
                ? "f".repeat(64)
                : "e".repeat(64),
          },
        ],
        [
          "state digest",
          {
            stateDigest:
              selector.stateDigest === "f".repeat(64)
                ? "0".repeat(64)
                : "f".repeat(64),
          },
        ],
        [
          "pairwise digest",
          {
            pairwiseDigest:
              selector.pairwiseDigest === "0".repeat(64)
                ? "1".repeat(64)
                : "0".repeat(64),
          },
        ],
        [
          "profile",
          {
            profile: selector.profile === "demo" ? "full" : "demo",
          },
        ],
        [
          "axes",
          {
            axes: {
              ...selector.axes,
              lifecycle:
                selector.axes.lifecycle === "open" ? "published" : "open",
            },
          },
        ],
        ["role", { role: otherRole(selector.role) }],
        ["catalog route", { catalogRoute: "/not-the-catalog-route" }],
        ["resolved route", { resolvedRoute: "/not-the-resolved-route" }],
      ];
      for (const [field, patch] of mismatches) {
        expect(() =>
          resolvePreflightStateSelector({
            source,
            selector: withSelectorDigest(selector, patch),
          }),
        ).toThrow(field);
      }
      expect(() =>
        resolvePreflightStateSelector({
          source,
          selector: withSelectorDigest(selector, {
            stateId: "state-does-not-exist",
          }),
        }),
      ).toThrow("Unknown preflight canary stateId");
    });
  });

  it("rejects each canonical axis independently after selector digest recomputation", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selector = createPreflightStateSelector({ source, state });
      for (const [axis, mutate] of canonicalAxisMutations) {
        expect(
          () =>
            resolvePreflightStateSelector({
              source,
              selector: withSelectorDigest(selector, {
                axes: mutate(selector.axes),
              }),
            }),
          `${axis} axis must reject`,
        ).toThrow("axes");
      }
    });
  });

  it("rejects duplicate state ids before any runtime work", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const duplicateSource = {
        ...source,
        plan: {
          ...source.plan,
          states: [...source.plan.states, state],
        },
      } as typeof source;
      const selector = createPreflightStateSelector({ source, state });
      expect(() =>
        resolvePreflightStateSelector({ source: duplicateSource, selector }),
      ).toThrow("duplicate state identity");
    });
  });

  it("maps a complete SHA-independent semantic tuple to exactly one current state", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selector = createPreflightStateSelector({ source, state });
      const semantic = preflightStateSemanticSelectorSchema.parse({
        profile: selector.profile,
        axes: selector.axes,
        role: selector.role,
        catalogRoute: selector.catalogRoute,
        resolvedRoute: selector.resolvedRoute,
      });
      const resolved = resolvePreflightStateBySemantics({
        source,
        semantic,
      });
      expect(resolved.state.stateId).toBe(state.stateId);
      expect(() =>
        resolvePreflightStateBySemantics({
          source,
          semantic: { ...semantic, stateId: state.stateId },
        }),
      ).toThrow("Invalid preflight semantic state selector");
      expect(() =>
        resolvePreflightStateBySemantics({
          source,
          semantic: { ...semantic, resolvedRoute: "/no-match" },
        }),
      ).toThrow("matched no current SOURCE state");
    });
  });

  it("rejects zero and multiple semantic matches instead of guessing", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selector = createPreflightStateSelector({ source, state });
      const semantic = preflightStateSemanticSelectorSchema.parse({
        profile: selector.profile,
        axes: selector.axes,
        role: selector.role,
        catalogRoute: selector.catalogRoute,
        resolvedRoute: selector.resolvedRoute,
      });
      const multipleSource = {
        ...source,
        plan: {
          ...source.plan,
          states: [
            ...source.plan.states,
            { ...state, stateId: "state-semantic-duplicate" },
          ],
        },
      } as typeof source;
      expect(() =>
        resolvePreflightStateBySemantics({
          source: multipleSource,
          semantic,
        }),
      ).toThrow("matched multiple current SOURCE states");
    });
  });
});
