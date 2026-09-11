import type { ResolvePlanInput } from "@customreport/shared";
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
      outcomeCommandHash({ ...command, version: 2, commandId: "different" }),
    ).toBe(outcomeCommandHash(command));
  });
  it("normalizes stage-set ordering but distinguishes absent and explicit empty", () => {
    expect(
      outcomeCommandHash({
        ...command,
        stageNames: ["Testing", "Development"],
      }),
    ).toBe(
      outcomeCommandHash({
        ...command,
        stageNames: ["Development", "Testing"],
      }),
    );
    expect(outcomeCommandHash({ ...command, stageNames: [] })).not.toBe(
      outcomeCommandHash(command),
    );
  });
  it("distinguishes explicit clearing from omission and different intent", () => {
    const original = outcomeCommandHash(command);
    expect(outcomeCommandHash({ ...command, nextStepText: null })).not.toBe(
      original,
    );
    expect(outcomeCommandHash({ ...command, text: "Changed" })).not.toBe(
      original,
    );
    expect(outcomeCommandHash({ ...command, outcome: "done" })).not.toBe(
      original,
    );
    expect(
      outcomeCommandHash({
        reportSectionId: id,
        version: 1,
        commandId: id,
        recordId: id,
      }),
    ).not.toBe(original);
  });
});
