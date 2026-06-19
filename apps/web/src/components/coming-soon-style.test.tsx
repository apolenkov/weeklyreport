/**
 * @vitest-environment jsdom
 *
 * coming-soon-style-consistency: guards that every deferred-feature affordance
 * keeps the single canonical `ComingSoonBadge` style and that no component
 * hand-rolls a bespoke "Coming Soon" pill. No production code changed by this
 * change — these are the regression guards that pin the already-uniform state.
 */

import "@testing-library/jest-dom/vitest";

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COMING_SOON_TOOLTIP_ANCHOR } from "./coming-soon-tooltip-anchor";
import { PdfExportComingSoonControl } from "./lead/pdf-export-coming-soon";
import { VersionComingSoonControl } from "./lead/version-coming-soon";
import { AgentReviewComingSoon } from "./report-shell/agent-review-coming-soon";

// The canonical amber tokens baked into the shared primitive. `cn` uses
// tailwind-merge, so a control passing a conflicting `bg-*`/`text-*color*`
// className would STRIP these — asserting their presence has teeth.
const CANONICAL_BG = "bg-amber-100";
const CANONICAL_FG = "text-amber-700";

describe("ComingSoonBadge — single canonical style", () => {
  it("the primitive renders the canonical amber tokens + data-state", () => {
    render(<ComingSoonBadge />);
    const badge = screen.getByText("Coming Soon");
    expect(badge).toHaveAttribute("data-state", "coming-soon");
    expect(badge).toHaveClass(CANONICAL_BG, CANONICAL_FG);
  });

  it("every deferred control's badge resolves to the same canonical tokens", () => {
    const controls = [
      <AgentReviewComingSoon key="agent" />,
      <PdfExportComingSoonControl key="pdf" />,
      <VersionComingSoonControl key="version" />,
    ];
    for (const control of controls) {
      const { container, unmount } = render(control);
      const badge = container.querySelector('[data-state="coming-soon"]');
      expect(badge).not.toBeNull();
      // Each badge carries the canonical tokens — none overrides bg/fg.
      expect(badge?.classList.contains(CANONICAL_BG)).toBe(true);
      expect(badge?.classList.contains(CANONICAL_FG)).toBe(true);
      unmount();
    }
  });
});

describe("ComingSoonBadge — single centred tooltip anchor (#91)", () => {
  // The shared anchor centres the badge under the control regardless of width.
  // Splitting it into tokens gives the assertion teeth: a control that diverges
  // (or reintroduces `right-0`) drops a token and fails.
  const ANCHOR_TOKENS = COMING_SOON_TOOLTIP_ANCHOR.split(" ");

  it("the shared anchor centres the badge and never right-aligns it", () => {
    expect(ANCHOR_TOKENS).toContain("left-1/2");
    expect(ANCHOR_TOKENS).toContain("-translate-x-1/2");
    expect(ANCHOR_TOKENS).not.toContain("right-0");
  });

  it("every tooltip control's badge uses the identical centred anchor", () => {
    const controls = [
      <AgentReviewComingSoon key="agent" />,
      <PdfExportComingSoonControl key="pdf" />,
      <VersionComingSoonControl key="version" />,
    ];
    for (const control of controls) {
      const { container, unmount } = render(control);
      const badge = container.querySelector('[data-state="coming-soon"]');
      expect(badge).not.toBeNull();
      for (const token of ANCHOR_TOKENS) {
        expect(badge?.classList.contains(token)).toBe(true);
      }
      // The wide text-labelled agent-review must NOT right-align (the bug).
      expect(badge?.classList.contains("right-0")).toBe(false);
      unmount();
    }
  });
});

describe("#91 — all six tooltip controls share the centred anchor (source scan)", () => {
  // The render test above reaches only the 3 exported controls. The other 3
  // (nav theme/language, admin holidays) are internal functions needing
  // providers to render, so a filesystem scan guards them: each tooltip
  // control's source MUST consume the shared const and carry no `right-0`
  // anchor. Without this, hard-coding `right-0` onto e.g. the nav theme badge
  // (tailwind-merge overriding the shared anchor) would pass every other test.
  // This test file lives in apps/web/src/components, so its own dir is the
  // root the control paths below are relative to.
  const componentsRoot = path.dirname(fileURLToPath(import.meta.url));
  const TOOLTIP_CONTROL_FILES = [
    "report-shell/agent-review-coming-soon.tsx",
    "lead/version-coming-soon.tsx",
    "lead/pdf-export-coming-soon.tsx",
    "navigation/nav-bar.tsx",
    "admin/settings-tab.tsx",
  ];

  it("every tooltip control source consumes the shared const, none right-aligns", () => {
    for (const rel of TOOLTIP_CONTROL_FILES) {
      const source = readFileSync(path.join(componentsRoot, rel), "utf8");
      expect(source).toContain("COMING_SOON_TOOLTIP_ANCHOR");
      // A bespoke `right-0` anchor on a ComingSoon tooltip is the exact bug
      // #91 fixes; the shared const centres instead.
      expect(source).not.toContain("absolute right-0");
    }
  });
});

describe("deferred-feature-pattern — no bespoke 'Coming Soon' pill", () => {
  // The literal "Coming Soon" may appear ONLY as: the primitive's rendered
  // text, a native title="Coming Soon" attribute, or a comment. Any other
  // rendered occurrence is a bespoke pill that bypasses the shared primitive.
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const SCAN_ROOTS = [
    path.join(repoRoot, "apps/web/src"),
    path.join(repoRoot, "packages/ui/src"),
  ];
  const PRIMITIVE = "coming-soon-badge.tsx";

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      if (!/\.tsx?$/.test(entry)) return [];
      if (/\.(test|spec)\.tsx?$/.test(entry)) return [];
      if (entry === PRIMITIVE) return [];
      return [full];
    });
  }

  function bespokeOccurrences(file: string): number[] {
    const lines = readFileSync(file, "utf8").split("\n");
    return lines.flatMap((line, i) => {
      if (!line.includes("Coming Soon")) return [];
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("{/*");
      if (isComment) return [];
      // Strip allowed attribute carriers, then see if any text remains.
      const stripped = line
        .replaceAll('title="Coming Soon"', "")
        .replaceAll(/aria-label="[^"]*"/gi, "");
      return stripped.includes("Coming Soon") ? [i + 1] : [];
    });
  }

  it("no source file renders 'Coming Soon' text outside the shared primitive", () => {
    const violations = SCAN_ROOTS.flatMap(sourceFiles).flatMap((file) =>
      bespokeOccurrences(file).map((line) => `${file}:${line}`),
    );
    expect(violations).toEqual([]);
  });
});
