import { describe, expect, it } from "vitest";

import { representativeInputForFill } from "../interaction/preflight-reveal-transition.ts";

describe("preflight representative fill inputs", () => {
  it("keeps datetime-local values valid for native browser validation", () => {
    expect(representativeInputForFill({ inputType: "datetime-local" })).toEqual(
      {
        kind: "fill",
        value: "2026-01-01T12:00",
      },
    );
  });
});
