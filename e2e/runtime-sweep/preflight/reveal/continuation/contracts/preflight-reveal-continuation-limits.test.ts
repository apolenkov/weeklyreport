import { describe, expect, it } from "vitest";

import {
  REVEAL_CONTINUATION_LIMITS,
  revealContinuationLimitEnvironment,
  revealContinuationLimitsFromEnvironment,
} from "./preflight-reveal-continuation-limits.ts";

describe("source-bound reveal continuation limits", () => {
  it("accepts only the exact canonical limit environment", () => {
    const environment = revealContinuationLimitEnvironment(
      REVEAL_CONTINUATION_LIMITS,
    );
    expect(revealContinuationLimitsFromEnvironment(environment)).toBe(
      REVEAL_CONTINUATION_LIMITS,
    );
    expect(REVEAL_CONTINUATION_LIMITS).toEqual({
      softWallMs: 60_000,
      yieldReserveMs: 10_000,
      maxTerminalCandidates: 256,
      maxRevealActionDelta: 1024,
      hardWallMs: 90_000,
      killGraceMs: 10_000,
    });
  });

  it.each([
    ["RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_CHUNK_MS", "60001"],
    ["RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_YIELD_RESERVE_MS", "10001"],
    [
      "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_MAX_TERMINAL_CANDIDATES",
      "257",
    ],
    [
      "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_MAX_REVEAL_ACTION_DELTA",
      "1025",
    ],
    ["RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_HARD_WALL_MS", "90001"],
    ["RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_KILL_GRACE_MS", "10001"],
  ])("rejects tampered %s", (name, value) => {
    expect(() =>
      revealContinuationLimitsFromEnvironment({ [name]: value }),
    ).toThrow(/source-bound/u);
  });
});
