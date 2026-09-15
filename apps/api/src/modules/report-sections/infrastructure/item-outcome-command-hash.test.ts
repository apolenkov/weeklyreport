import type { PromotePlanInput, ResolvePlanInput } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { outcomeCommandHash } from "./item-outcome-command-hash.js";

const id = "11111111-1111-4111-8111-111111111111";
const command: ResolvePlanInput = {
  reportSectionId: id,
  version: 1,
  commandId: id,
  source: { kind: "current", recordId: id },
  outcome: "continue",
};

describe("outcome command intent receipt", () => {
  it("ignores refreshed version and command envelope identity", () => {
    expect(
      outcomeCommandHash(
        { ...command, version: 2, commandId: "different" },
        "resolve",
      ),
    ).toBe(outcomeCommandHash(command, "resolve"));
  });
  it("normalizes stage-set ordering but distinguishes absent and explicit empty", () => {
    expect(
      outcomeCommandHash(
        { ...command, stageNames: ["Testing", "Development"] },
        "resolve",
      ),
    ).toBe(
      outcomeCommandHash(
        { ...command, stageNames: ["Development", "Testing"] },
        "resolve",
      ),
    );
    expect(
      outcomeCommandHash({ ...command, stageNames: [] }, "resolve"),
    ).not.toBe(outcomeCommandHash(command, "resolve"));
  });
  it("distinguishes explicit clearing from omission and different intent", () => {
    const original = outcomeCommandHash(command, "resolve");
    expect(
      outcomeCommandHash({ ...command, nextStepText: null }, "resolve"),
    ).not.toBe(original);
    expect(
      outcomeCommandHash({ ...command, text: "Changed" }, "resolve"),
    ).not.toBe(original);
    expect(
      outcomeCommandHash({ ...command, outcome: "done" }, "resolve"),
    ).not.toBe(original);
    expect(
      outcomeCommandHash(
        {
          reportSectionId: id,
          version: 1,
          commandId: id,
          recordId: id,
        },
        "restore",
      ),
    ).not.toBe(original);
  });

  it("distinguishes a status-preserving move to Next from legacy promotion", () => {
    const promotion: PromotePlanInput = {
      reportSectionId: id,
      version: 1,
      commandId: id,
      recordId: id,
    };

    expect(
      outcomeCommandHash({ ...promotion, target: "next" }, "promote"),
    ).not.toBe(outcomeCommandHash(promotion, "promote"));
    expect(
      outcomeCommandHash(
        {
          ...promotion,
          target: "next",
          version: 2,
          commandId: "different",
        },
        "promote",
      ),
    ).toBe(outcomeCommandHash({ ...promotion, target: "next" }, "promote"));
  });

  it("separates endpoints and canonicalizes omitted promotion target to Current", () => {
    const promotion: PromotePlanInput = {
      reportSectionId: id,
      version: 1,
      commandId: id,
      recordId: id,
    };

    expect(outcomeCommandHash(promotion, "promote")).toBe(
      outcomeCommandHash({ ...promotion, target: "current" }, "promote"),
    );
    expect(outcomeCommandHash(promotion, "promote")).not.toBe(
      outcomeCommandHash(promotion, "restore"),
    );
  });
});
