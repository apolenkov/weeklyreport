import { describe, expect, it } from "vitest";

import { createCapacitySurveyTiming } from "../capacity/preflight-capacity-survey-timing.ts";
import {
  type BrowserPreflightHarness,
  revealHarnessFor,
} from "./playwright-preflight.ts";
import { timedHarnessFor } from "./playwright-preflight-capacity-survey.ts";

const harnessFor = (
  advance: (durationMs: number) => void,
): BrowserPreflightHarness & {
  readonly navigateReveal: BrowserPreflightHarness["navigate"];
} => ({
  expectedOrigin: "http://127.0.0.1:3205",
  prepare: () => Promise.resolve(undefined),
  navigate: () => Promise.resolve(),
  navigateReveal: () => {
    advance(5);
    return Promise.resolve();
  },
  currentUrl: () => "http://127.0.0.1:3205/reveal",
  inventory: () => Promise.resolve({ controls: [], issues: [] }),
  executeReveal: () =>
    Promise.resolve({
      url: "http://127.0.0.1:3205/reveal",
      inventory: { controls: [], issues: [] },
      nonMutation: {
        status: "unchanged" as const,
        beforeDigest: "digest",
        afterDigest: "digest",
      },
    }),
});

describe("capacity survey timed reveal navigation", () => {
  it("accounts for navigateReveal through the real revealHarnessFor seam", async () => {
    let nowMs = 0;
    const timing = createCapacitySurveyTiming({
      enabled: true,
      now: () => nowMs,
    });
    const advance = (durationMs: number): void => {
      nowMs += durationMs;
    };
    const timedHarness = timedHarnessFor(harnessFor(advance), timing);
    const revealHarness = revealHarnessFor(timedHarness);

    timing.beginCandidateQueue();
    await revealHarness.navigate("/reveal");
    advance(3);
    timing.endCandidateQueue();

    const snapshot = timing.snapshot();
    expect(snapshot.navigateWallMs).toBe(5);
    expect(snapshot.externalUnionWallMs).toBe(5);
  });
});
