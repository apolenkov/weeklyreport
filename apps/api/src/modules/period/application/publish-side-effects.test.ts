import { describe, expect, it, vi } from "vitest";

import { emitPublishSideEffects } from "./publish-side-effects.js";

function deps(overrides: {
  readonly telemetryFails?: boolean;
  readonly cacheFails?: boolean;
  readonly onSideEffectError: (error: unknown) => void;
}) {
  const invalidateAnalyticsCache = vi.fn(() =>
    overrides.cacheFails
      ? Promise.reject(new Error("cache unavailable"))
      : Promise.resolve(),
  );
  return {
    invalidateAnalyticsCache,
    deps: {
      telemetry: {
        recordPublishedReport: () => {
          if (overrides.telemetryFails) throw new Error("metric unavailable");
        },
        recordPeriodPublished: () => undefined,
      },
      invalidateAnalyticsCache,
      onSideEffectError: overrides.onSideEffectError,
    },
  };
}

const prior = { priorStatus: "open" } as const;

// TASK-503.52 / C1165. The module states that a post-commit side-effect failure
// "must not fail the API response" and that each side effect is guarded
// independently. These tests extend that to the failure report itself (the
// reporting callback throws). The throwing callback is a fault injection, not
// an admitted production path: the production callback is a logger call (see
// the change); the policy follows the accepted TASK-503.32 contract.
describe("publish side effects — a failing failure report", () => {
  it("control: a telemetry failure is reported once and the cache is still invalidated", async () => {
    const onSideEffectError = vi.fn();
    const { deps: d, invalidateAnalyticsCache } = deps({
      telemetryFails: true,
      onSideEffectError,
    });

    await expect(emitPublishSideEffects(d, prior)).resolves.toBeUndefined();

    expect(onSideEffectError).toHaveBeenCalledOnce();
    expect(invalidateAnalyticsCache).toHaveBeenCalledOnce();
  });

  it("resolves when the report of a telemetry failure throws", async () => {
    const { deps: d } = deps({
      telemetryFails: true,
      onSideEffectError: () => {
        throw new Error("log transport unavailable");
      },
    });

    await expect(emitPublishSideEffects(d, prior)).resolves.toBeUndefined();
  });

  it("still invalidates the cache when the report of a telemetry failure throws", async () => {
    const { deps: d, invalidateAnalyticsCache } = deps({
      telemetryFails: true,
      onSideEffectError: () => {
        throw new Error("log transport unavailable");
      },
    });

    await emitPublishSideEffects(d, prior).catch(() => undefined);

    expect(invalidateAnalyticsCache).toHaveBeenCalledOnce();
  });

  it("resolves when the report of a cache failure throws", async () => {
    const { deps: d } = deps({
      cacheFails: true,
      onSideEffectError: () => {
        throw new Error("log transport unavailable");
      },
    });

    await expect(emitPublishSideEffects(d, prior)).resolves.toBeUndefined();
  });
});
