import { describe, expect, it } from "vitest";

import type { DomControlObservation } from "../../replay/dom/dom-inventory.ts";
import type { Action } from "../../source/contracts.ts";
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
  executeReveal: () => {
    advance(7);
    return Promise.resolve({
      url: "http://127.0.0.1:3205/reveal",
      inventory: { controls: [], issues: [] },
      nonMutation: {
        status: "unchanged" as const,
        beforeDigest: "digest",
        afterDigest: "digest",
      },
    });
  },
});

const control: DomControlObservation = {
  accessibleName: "More actions",
  controlKey: "button:More%20actions:1",
  disabled: false,
  domOrderKey: "0001:button:More%20actions:1",
  enabled: true,
  href: null,
  inputType: null,
  order: 1,
  role: "button",
  tagName: "button",
  visible: true,
};

const action: Action = {
  controlKey: control.controlKey,
  operation: "click",
  safety: "read-only",
  transition: "open",
};

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

  it("attributes candidate and replay execution and rejects an untagged timed call", async () => {
    let nowMs = 0;
    const timing = createCapacitySurveyTiming({
      enabled: true,
      now: () => nowMs,
    });
    const timedHarness = timedHarnessFor(
      harnessFor((durationMs) => {
        nowMs += durationMs;
      }),
      timing,
    );
    const executeReveal = timedHarness.executeReveal;
    if (executeReveal === undefined)
      throw new Error("Timed test harness lacks reveal execution");
    const execute = (executionKind?: "candidate" | "replay") =>
      executeReveal({
        ...(executionKind === undefined ? {} : { executionKind }),
        control,
        action,
        preparation: undefined,
      });

    timing.beginCandidateQueue();
    await execute("candidate");
    await execute("replay");
    timing.endCandidateQueue();

    expect(timing.snapshot()).toMatchObject({
      executeRevealWallMs: 14,
      candidateExecuteCount: 1,
      candidateExecuteWallMs: 7,
      replayExecuteCount: 1,
      replayExecuteWallMs: 7,
    });
    await expect(execute()).rejects.toThrow(
      "Timed reveal execution requires replay or candidate attribution",
    );
  });
});
