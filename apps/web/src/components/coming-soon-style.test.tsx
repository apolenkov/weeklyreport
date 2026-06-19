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

import { PdfExportComingSoonControl } from "./lead/pdf-export-coming-soon";
import { VersionComingSoonControl } from "./lead/version-coming-soon";
import { AgentReviewComingSoon } from "./report-shell/agent-review-coming-soon";
import { ForeignTagsComingSoon } from "./slides/foreign-tags-coming-soon";

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
      <ForeignTagsComingSoon key="foreign-tags" />,
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
