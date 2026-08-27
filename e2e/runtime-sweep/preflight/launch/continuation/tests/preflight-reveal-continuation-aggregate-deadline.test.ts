import { describe, expect, it } from "vitest";

import { aggregatePartitionDeadlinesFor } from "../preflight-reveal-continuation-aggregate-deadline.ts";
import {
  assertRevealContinuationActive,
  assertRevealContinuationTerminalPublicationActive,
} from "../preflight-reveal-continuation-parent.ts";

describe("reveal aggregate deadline reserve", () => {
  it("caps functional partition work before the global teardown reserve", () => {
    const first = aggregatePartitionDeadlinesFor({
      now: 0,
      monotonicNow: 0,
      outerDeadlineAt: 1400,
      outerDeadlineMonotonic: 1400,
      partitionMaxMs: 600,
      teardownReserveMs: 200,
      continuationReserveMs: 10,
    });
    expect(first.deadlineAt).toBe(600);
    expect(first.functionalDeadlineAt).toBe(590);

    const final = aggregatePartitionDeadlinesFor({
      now: 900,
      monotonicNow: 900,
      outerDeadlineAt: 1400,
      outerDeadlineMonotonic: 1400,
      partitionMaxMs: 600,
      teardownReserveMs: 200,
      continuationReserveMs: 10,
    });
    expect(final.deadlineAt).toBe(1200);
    expect(final.functionalDeadlineAt).toBe(1190);
    expect(final.deadlineAt).toBeLessThanOrEqual(1400 - 200);
    expect(final.functionalDeadlineAt).toBeLessThan(1400 - 200);
  });

  it("rejects new work in the reserve but allows terminal publication there", () => {
    const context = {
      deadlineMonotonic: 1400,
      functionalDeadlineMonotonic: 1190,
      monotonicNow: () => 1190,
      signal: new AbortController().signal,
    };
    expect(() => assertRevealContinuationActive(context)).toThrow(
      "Reveal continuation 24-minute deadline exceeded",
    );

    let monotonicNow = 1399;
    const terminalContext = {
      deadlineMonotonic: 1400,
      monotonicNow: () => monotonicNow,
      signal: new AbortController().signal,
    };
    expect(() =>
      assertRevealContinuationTerminalPublicationActive(terminalContext),
    ).not.toThrow();
    monotonicNow = 1400;
    expect(() =>
      assertRevealContinuationTerminalPublicationActive(terminalContext),
    ).toThrow("Reveal continuation 24-minute deadline exceeded");
  });
});
