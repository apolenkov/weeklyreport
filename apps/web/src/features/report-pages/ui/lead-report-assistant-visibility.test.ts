import { describe, expect, it } from "vitest";

import { canShowLeadReportAssistant } from "./lead/chrome/lead-form-toolbar-controls";

describe("lead report assistant surface visibility", () => {
  it.each(["head", "admin", "viewer"] as const)(
    "does not render for %s surfaces",
    (role) => {
      expect(canShowLeadReportAssistant(role)).toBe(false);
    },
  );

  it("renders only for the Lead role", () => {
    expect(canShowLeadReportAssistant("lead")).toBe(true);
    expect(canShowLeadReportAssistant(null)).toBe(false);
    expect(canShowLeadReportAssistant(undefined)).toBe(false);
  });
});
