import { describe, expect, it } from "vitest";

import {
  itemRailTone,
  severityRailTone,
  STATUS_BADGE,
} from "./accordion-tokens";

describe("record status tokens", () => {
  it("shares neutral pause badge and rail foreground", () => {
    expect(STATUS_BADGE.paused.label).toBe("Paused");
    expect(STATUS_BADGE.paused.fg).toBe("var(--color-muted-foreground)");
    expect(itemRailTone("paused")).toBe("var(--color-muted-foreground)");
  });

  it("preserves alarm and other progress tokens", () => {
    expect(STATUS_BADGE["at-risk"].fg).toBe("var(--color-status-at-risk-fg)");
    expect(STATUS_BADGE.blocked.fg).toBe("var(--color-destructive)");
    expect(severityRailTone("at-risk")).toBe(
      "var(--color-status-at-risk-border)",
    );
    expect(itemRailTone("blocked")).toBe("var(--color-destructive)");
    expect(itemRailTone("planned")).toBe("var(--color-border)");
  });
});
