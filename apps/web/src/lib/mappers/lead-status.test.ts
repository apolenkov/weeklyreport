import { describe, expect, it } from "vitest";

import { deriveLeadStatus } from "./lead-status";

describe("deriveLeadStatus", () => {
  it("returns 'submitted' for a submitted section regardless of content count", () => {
    expect(
      deriveLeadStatus({ sectionStatus: "submitted", contentCount: 5 }),
    ).toBe("submitted");
  });

  it("returns 'submitted' for a submitted section with zero content (terminal state)", () => {
    expect(
      deriveLeadStatus({ sectionStatus: "submitted", contentCount: 0 }),
    ).toBe("submitted");
  });

  it("returns 'draft' for a draft section that has report content", () => {
    expect(deriveLeadStatus({ sectionStatus: "draft", contentCount: 3 })).toBe(
      "draft",
    );
  });

  it("returns 'pending' for a draft section with zero content", () => {
    expect(deriveLeadStatus({ sectionStatus: "draft", contentCount: 0 })).toBe(
      "pending",
    );
  });

  it("returns 'pending' for an empty draft section (computed presentation-only state)", () => {
    // 'pending' has no DB enum equivalent: it is purely derived from
    // (sectionStatus = 'draft') + (contentCount = 0).
    const result = deriveLeadStatus({
      sectionStatus: "draft",
      contentCount: 0,
    });
    expect(result).toBe("pending");
  });

  it("returns 'draft' for a draft section with exactly one content item (boundary)", () => {
    expect(deriveLeadStatus({ sectionStatus: "draft", contentCount: 1 })).toBe(
      "draft",
    );
  });
});
