import { describe, expect, it } from "vitest";

import { extractRecipientEmail } from "./reminders-row-mappers";

/**
 * Phase 32-C / H-02 — dedupe-key recipient extraction regression.
 *
 * Pre-fix the legacy regex `/Z:(.+)$/` matched only the v2.0 ISO-suffixed
 * shape and silently returned '' for every Phase 28+ key. Both shapes must
 * round-trip the recipient email correctly.
 */
describe("extractRecipientEmail (Phase 32-C / H-02)", () => {
  it("parses legacy v2.0 shape: ruleId:<ISO with Z>:email", () => {
    const key =
      "66666666-6666-4666-8666-666666666666:2026-04-12T10:00:00.000Z:user@example.com";
    expect(extractRecipientEmail(key)).toBe("user@example.com");
  });

  it("parses Phase 28+ deadline shape: ruleId:deadline:YYYY-MM-DD:email", () => {
    const key =
      "66666666-6666-4666-8666-666666666666:deadline:2026-04-12:lead1@customreport.local";
    expect(extractRecipientEmail(key)).toBe("lead1@customreport.local");
  });

  it("parses Phase 29+ escalation shape: ruleId:escalation:YYYY-MM-DD:email", () => {
    const key =
      "66666666-6666-4666-8666-666666666666:escalation:2026-04-12:head@customreport.local";
    expect(extractRecipientEmail(key)).toBe("head@customreport.local");
  });

  it("parses Phase 28+ follow_up shape (kind contains underscore but no colon)", () => {
    const key =
      "66666666-6666-4666-8666-666666666666:follow_up:2026-04-12:user@example.com";
    expect(extractRecipientEmail(key)).toBe("user@example.com");
  });

  it("returns empty string when last segment is not an email shape", () => {
    expect(extractRecipientEmail("rule:deadline:2026-04-12:not-an-email")).toBe(
      "",
    );
  });

  it("returns empty string for an unparseable / empty key", () => {
    expect(extractRecipientEmail("")).toBe("");
    expect(extractRecipientEmail("garbage")).toBe("");
  });

  it("rejects whitespace and colon characters in the local-part", () => {
    expect(extractRecipientEmail("rule:foo:bar baz@example.com")).toBe("");
  });
});
