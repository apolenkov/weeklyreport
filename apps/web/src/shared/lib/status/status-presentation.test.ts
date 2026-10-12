import type { CanonicalStatus } from "@weeklyreport/shared";
import {
  AlertTriangle,
  CircleCheck,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  statusDotClassName,
  statusIcon,
  statusLabel,
  statusToneClassName,
} from "./status-presentation";

// Canonical vocabulary parity — a value drift fails here.
const LABELS: Record<
  CanonicalStatus,
  { screen: string; print: string; worstPill: string }
> = {
  blocked: { screen: "Blocked", print: "Blocked", worstPill: "Blockers" },
  "at-risk": { screen: "At risk", print: "At Risk", worstPill: "At risk" },
  "on-track": { screen: "On track", print: "On Track", worstPill: "On track" },
  empty: { screen: "No status", print: "No status", worstPill: "No status" },
};

const DOTS: Record<CanonicalStatus, string> = {
  blocked: "bg-[var(--color-destructive)]",
  "at-risk": "bg-[var(--color-status-dot-at-risk)]",
  "on-track": "bg-[var(--color-primary)]",
  empty: "bg-[var(--color-muted-foreground)] opacity-50",
};

describe("statusLabel", () => {
  it("resolves every status/variant to its expected label", () => {
    for (const status of Object.keys(LABELS) as CanonicalStatus[]) {
      expect(statusLabel(status, "screen")).toBe(LABELS[status].screen);
      expect(statusLabel(status, "print")).toBe(LABELS[status].print);
      expect(statusLabel(status, "worstPill")).toBe(LABELS[status].worstPill);
    }
  });
});

describe("statusDotClassName", () => {
  it("resolves every status to its expected dot class", () => {
    for (const status of Object.keys(DOTS) as CanonicalStatus[]) {
      expect(statusDotClassName(status)).toBe(DOTS[status]);
    }
  });
});

describe("statusToneClassName", () => {
  it("keeps the blocked pill text on --color-destructive (not chip-blocked-text)", () => {
    expect(statusToneClassName("blocked")).toContain(
      "text-[var(--color-destructive)]",
    );
    expect(statusToneClassName("blocked")).not.toContain("chip-blocked-text");
    expect(statusToneClassName("blocked")).toContain(
      "bg-[var(--color-status-blocked-bg)]",
    );
    expect(statusToneClassName("blocked")).not.toContain("chip-blocked-bg");
  });
});

describe("statusIcon", () => {
  it("carries the alert glyph only for blocked and at-risk", () => {
    expect(statusIcon("blocked")).toBe(AlertTriangle);
    expect(statusIcon("at-risk")).toBe(AlertTriangle);
    expect(statusIcon("on-track")).toBeNull();
    expect(statusIcon("empty")).toBeNull();
  });

  it("preserves the shape-distinct product icons", () => {
    expect(statusIcon("on-track", "product")).toBe(CircleCheck);
    expect(statusIcon("at-risk", "product")).toBe(TriangleAlert);
    expect(statusIcon("blocked", "product")).toBe(OctagonX);
  });
});
