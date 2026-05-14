import { describe, expect, it } from "vitest";

import {
  parseUntickedItems,
  buildSection,
  rewriteHandoff,
} from "./handoff-sync";

describe("handoff-sync — parseUntickedItems", () => {
  it("parses CI and manual items, ignores ticked rows", () => {
    const md = [
      "## Section",
      "- [ ] AUTH-LOGIN-001 [manual] — Login as lead",
      "- [ ] AUTH-FILTERS-001 [CI] — Role filter tests",
      "- [x] DONE-001 [manual] — already done", // ignored
      "- [ ] PDF-COOKIE-001 [CI] — PDF cookie seam test",
    ].join("\n");

    const items = parseUntickedItems(md);

    expect(items).toEqual([
      { id: "AUTH-LOGIN-001", gate: "manual", description: "Login as lead" },
      { id: "AUTH-FILTERS-001", gate: "CI", description: "Role filter tests" },
      { id: "PDF-COOKIE-001", gate: "CI", description: "PDF cookie seam test" },
    ]);
  });

  it("returns empty array when no unticked items present", () => {
    expect(parseUntickedItems("# Empty\n\nbody")).toEqual([]);
  });

  it("preserves description with multiple words and colons", () => {
    const md =
      "- [ ] FUNC-INTG-001 [CI] — Integration suite green: `pnpm test:e2e:integration`";
    const items = parseUntickedItems(md);
    expect(items).toHaveLength(1);
    expect(items[0]?.description).toContain("Integration suite green");
  });
});

describe("handoff-sync — buildSection", () => {
  it("groups manual and CI items with counts", () => {
    const out = buildSection([
      { id: "A-B-001", gate: "manual", description: "m" },
      { id: "A-B-002", gate: "CI", description: "c" },
      { id: "A-B-003", gate: "manual", description: "m2" },
    ]);

    expect(out).toContain("## Pending Manual Smoke");
    expect(out).toContain("### Manual (2)");
    expect(out).toContain("### CI-gated (1)");
    expect(out).toContain("**A-B-001** — m");
  });

  it("renders zero-count sections cleanly", () => {
    const out = buildSection([]);
    expect(out).toContain("### Manual (0)");
    expect(out).toContain("### CI-gated (0)");
  });
});

describe("handoff-sync — rewriteHandoff", () => {
  it("replaces between markers idempotently", () => {
    const original = [
      "# Handoff",
      "",
      "<!-- handoff-sync:start -->",
      "OLD CONTENT",
      "<!-- handoff-sync:end -->",
      "tail",
    ].join("\n");

    const next = rewriteHandoff(original, "NEW SECTION\n");
    expect(next).toContain("NEW SECTION");
    expect(next).not.toContain("OLD CONTENT");
    expect(next).toContain("tail");

    // Running again is a no-op
    const next2 = rewriteHandoff(next, "NEW SECTION\n");
    expect(next2).toBe(next);
  });

  it("appends bounded section when markers absent", () => {
    const original = "# Handoff\n\nbody";
    const next = rewriteHandoff(original, "GEN\n");

    expect(next).toMatch(/<!-- handoff-sync:start -->/);
    expect(next).toMatch(/GEN/);
    expect(next).toMatch(/<!-- handoff-sync:end -->/);
    expect(next.startsWith("# Handoff\n\nbody")).toBe(true);
  });

  it("preserves content before AND after the markers when replacing", () => {
    const original = [
      "# Header",
      "",
      "PRE",
      "",
      "<!-- handoff-sync:start -->",
      "OLD",
      "<!-- handoff-sync:end -->",
      "",
      "POST",
    ].join("\n");

    const next = rewriteHandoff(original, "GEN\n");

    expect(next).toContain("PRE");
    expect(next).toContain("POST");
    expect(next).toContain("GEN");
    expect(next).not.toContain("OLD");
  });
});
