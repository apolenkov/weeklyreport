/**
 * @vitest-environment jsdom
 *
 * fix-coming-soon-tooltip-clipping: the deferred-feature ComingSoon controls now
 * render their tooltip through the shared Radix portal (escaping the
 * `overflow-x-auto` clipping that hid the agent-review + holidays tooltips).
 * These guards pin: the single canonical amber badge, the Radix wrapper on every
 * control, retirement of the CSS anchor, and the no-bespoke-pill invariant.
 */

import "@testing-library/jest-dom/vitest";

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});

describe("Coming-Soon controls render the amber badge through the Radix portal", () => {
  const controls = [
    {
      label: "agent-review",
      node: <AgentReviewComingSoon />,
      testid: "agent-review-coming-soon",
    },
    {
      label: "pdf-export",
      node: <PdfExportComingSoonControl />,
      testid: "lead-pdf-export-coming-soon",
    },
    {
      label: "version",
      node: <VersionComingSoonControl />,
      testid: "version-coming-soon",
    },
  ];

  it.each(controls)(
    "$label: focus opens a portaled amber ComingSoonBadge (no second colour variant)",
    async ({ node, testid }) => {
      render(node);
      // Portaled: no badge is in the DOM before the control is interacted with.
      expect(document.querySelector('[data-state="coming-soon"]')).toBeNull();

      fireEvent.focus(screen.getByTestId(testid));

      const tip = await screen.findByRole("tooltip");
      const badge = tip.querySelector('[data-state="coming-soon"]');
      expect(badge).not.toBeNull();
      expect(badge?.classList.contains(CANONICAL_BG)).toBe(true);
      expect(badge?.classList.contains(CANONICAL_FG)).toBe(true);
      // The chromeless content must NOT fall back to the Radix dark surface.
      expect(tip.classList.contains("bg-foreground")).toBe(false);
    },
  );
});

describe("every tooltip control migrated to the shared Radix wrapper (source scan)", () => {
  // The render test reaches only the 3 exported controls; the other 3 (nav
  // theme/language, admin holidays) are internal functions needing providers/
  // tab context, so a filesystem scan guards them.
  const componentsRoot = path.dirname(fileURLToPath(import.meta.url));
  const TOOLTIP_CONTROL_FILES = [
    "report-shell/agent-review-coming-soon.tsx",
    "lead/version-coming-soon.tsx",
    "lead/pdf-export-coming-soon.tsx",
    "navigation/nav-bar.tsx",
    "admin/settings-tab.tsx",
  ];

  it("each control uses ComingSoonTooltip and dropped the retired CSS anchor", () => {
    for (const rel of TOOLTIP_CONTROL_FILES) {
      const source = readFileSync(path.join(componentsRoot, rel), "utf8");
      expect(source).toContain("ComingSoonTooltip");
      expect(source).not.toContain("COMING_SOON_TOOLTIP_ANCHOR");
      // A bespoke `right-0` anchor on a ComingSoon tooltip was the original bug.
      expect(source).not.toContain("absolute right-0");
    }
  });

  it("the holidays tab keeps a persistent ComingSoonBadge for its accessible name", () => {
    // The Radix tooltip badge is portaled (hover-only), so the holidays span
    // carries a PERSISTENT (sr-only) ComingSoonBadge — the tab's accessible name
    // still announces the coming-soon state without adding an aria-label.
    const source = readFileSync(
      path.join(componentsRoot, "admin/settings-tab.tsx"),
      "utf8",
    );
    expect(source).toContain("ComingSoonBadge");
    expect(source).toContain("sr-only");
  });
});

describe("every inert Coming Soon control — no stacked native title", () => {
  // Inert ComingSoon controls expose their state through their `aria-label`
  // (or visible text) plus the amber ComingSoonBadge tooltip. A native
  // `title="Coming Soon"` on the same control stacked a SECOND browser-native
  // tooltip over the badge — the double-tooltip glitch. No control may carry a
  // native title; this source scan guards every one of them.
  const componentsRoot = path.dirname(fileURLToPath(import.meta.url));
  const INERT_CONTROL_FILES = [
    "report-shell/agent-review-coming-soon.tsx",
    "lead/version-coming-soon.tsx",
    "lead/pdf-export-coming-soon.tsx",
    "navigation/nav-bar.tsx",
    "admin/settings-tab.tsx",
  ];

  it("no inert control source carries title=Coming Soon", () => {
    const violations = INERT_CONTROL_FILES.filter((rel) =>
      readFileSync(path.join(componentsRoot, rel), "utf8").includes(
        'title="Coming Soon"',
      ),
    );
    expect(violations).toEqual([]);
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
