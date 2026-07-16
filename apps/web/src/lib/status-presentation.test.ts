import type { CanonicalStatus } from "@customreport/shared";
import { AlertTriangle } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  statusDotClassName,
  statusIcon,
  statusLabel,
  statusToneClassName,
  worstTrafficStatus,
} from "./status-presentation";

// Frozen expectations mirror the exact vocabulary the surfaces rendered before
// consolidation — a parity guard, so a value drift fails here.
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
  it("resolves every status/variant to its pre-change label", () => {
    for (const status of Object.keys(LABELS) as CanonicalStatus[]) {
      expect(statusLabel(status, "screen")).toBe(LABELS[status].screen);
      expect(statusLabel(status, "print")).toBe(LABELS[status].print);
      expect(statusLabel(status, "worstPill")).toBe(LABELS[status].worstPill);
    }
  });
});

describe("statusDotClassName", () => {
  it("resolves every status to its pre-change dot class", () => {
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
  });
});

describe("statusIcon", () => {
  it("carries the alert glyph only for blocked and at-risk", () => {
    expect(statusIcon("blocked")).toBe(AlertTriangle);
    expect(statusIcon("at-risk")).toBe(AlertTriangle);
    expect(statusIcon("on-track")).toBeNull();
    expect(statusIcon("empty")).toBeNull();
  });
});

describe("worstTrafficStatus", () => {
  it.each([
    { statuses: [], expected: null },
    { statuses: [null, undefined], expected: null },
    { statuses: ["green", null], expected: "green" },
    { statuses: ["green", "yellow"], expected: "yellow" },
    { statuses: ["red", "green", "yellow"], expected: "red" },
    { statuses: ["yellow", "red", "green"], expected: "red" },
  ] as const)("returns $expected for $statuses", ({ statuses, expected }) => {
    expect(worstTrafficStatus(statuses)).toBe(expected);
  });
});
