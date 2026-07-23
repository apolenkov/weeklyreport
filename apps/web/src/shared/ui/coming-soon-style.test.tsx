/**
 * @vitest-environment jsdom
 *
 * Deferred-feature ComingSoon controls render their tooltip through the shared
 * Radix portal (escaping `overflow-x-auto` clipping that would hide tooltips
 * inside scroll containers). These guards pin: the single canonical amber
 * badge, the Radix wrapper on every control, retirement of the CSS anchor, and
 * the no-bespoke-pill invariant.
 */

import "@testing-library/jest-dom/vitest";

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import {
  ComingSoonControl,
  ComingSoonIconButton,
} from "@customreport/ui/components/coming-soon-control";
import { fireEvent, render, screen } from "@testing-library/react";
import { History } from "lucide-react";
import { describe, expect, it } from "vitest";

import { VersionComingSoonControl } from "../../features/admin/ui/version-coming-soon";
import { PdfExportComingSoonControl } from "../../features/pdf-export/ui/pdf-export-coming-soon";
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

describe("shared coming-soon primitive owns the inert button chrome", () => {
  // Parity-by-construction: the five button controls compose this primitive, so
  // asserting the chrome here replaces the retired per-file source scans.
  const INERT_CLASSES = [
    "cursor-default",
    "border-[var(--color-border)]",
    "bg-[var(--color-surface-empty)]",
    "text-[var(--color-muted-foreground)]",
  ];

  it("icon-only toolbar shape carries the inert chrome + square geometry", () => {
    render(
      <ComingSoonIconButton
        icon={History}
        shape="toolbar"
        ariaLabel="Version history is coming soon"
        testId="primitive-toolbar"
      />,
    );
    const button = screen.getByTestId("primitive-toolbar");
    expect(button).toHaveClass(...INERT_CLASSES);
    expect(button).toHaveClass(
      "h-[var(--toolbar-control-h)]",
      "w-[var(--toolbar-control-h)]",
      "shrink-0",
      "rounded-full",
    );
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    expect(button).not.toHaveAttribute("title");
    // Fixed-size lucide icon slot, aria-hidden so it adds no accessible name.
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("icon-only nav shape carries the inert chrome + pill geometry", () => {
    render(
      <ComingSoonIconButton
        icon={History}
        shape="nav"
        ariaLabel="Language selection is coming soon"
        testId="primitive-nav"
      />,
    );
    const button = screen.getByTestId("primitive-nav");
    expect(button).toHaveClass(...INERT_CLASSES);
    expect(button).toHaveClass(
      "h-8",
      "w-10",
      "px-0",
      "gap-1.5",
      "rounded-[var(--radius-pill)]",
    );
  });

  it("labelled variant renders its label and default touch-target geometry", () => {
    render(
      <ComingSoonControl
        icon={History}
        label="Agent review"
        ariaLabel="Agent review is coming soon"
        testId="primitive-labelled"
      />,
    );
    const button = screen.getByTestId("primitive-labelled");
    expect(button).toHaveClass(...INERT_CLASSES);
    expect(button).toHaveClass(
      "min-h-[var(--touch-target-min)]",
      "px-4",
      "py-1.5",
      "text-sm",
      "rounded-[var(--radius-pill)]",
    );
    expect(button).toHaveTextContent("Agent review");
  });

  it("labelled compact variant swaps to the toolbar-height geometry", () => {
    render(
      <ComingSoonControl
        icon={History}
        label="Agent review"
        ariaLabel="Agent review is coming soon"
        testId="primitive-compact"
        compact
      />,
    );
    const button = screen.getByTestId("primitive-compact");
    expect(button).toHaveClass(
      "h-[var(--toolbar-control-h)]",
      "px-2.5",
      "text-xs",
    );
    expect(button).not.toHaveClass("min-h-[var(--touch-target-min)]");
  });

  it("opens the amber ComingSoonBadge through the Radix portal on focus", async () => {
    render(
      <ComingSoonIconButton
        icon={History}
        shape="toolbar"
        ariaLabel="Version history is coming soon"
        testId="primitive-portal"
      />,
    );
    expect(document.querySelector('[data-state="coming-soon"]')).toBeNull();

    fireEvent.focus(screen.getByTestId("primitive-portal"));

    await screen.findByRole("tooltip");
    const content = document.querySelector('[data-slot="tooltip-content"]');
    const badge = content?.querySelector('[data-state="coming-soon"]');
    expect(badge).not.toBeNull();
    expect(badge?.classList.contains(CANONICAL_BG)).toBe(true);
    expect(badge?.classList.contains(CANONICAL_FG)).toBe(true);
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

      await screen.findByRole("tooltip");
      // The VISIBLE badge lives in the Radix content (`data-slot`), not in the
      // sr-only `role="tooltip"` description node (which the whitespace
      // `aria-label` now blanks — see below).
      const content = document.querySelector('[data-slot="tooltip-content"]');
      expect(content).not.toBeNull();
      const badge = content?.querySelector('[data-state="coming-soon"]');
      expect(badge).not.toBeNull();
      expect(badge?.classList.contains(CANONICAL_BG)).toBe(true);
      expect(badge?.classList.contains(CANONICAL_FG)).toBe(true);
      // The chromeless content must NOT fall back to the Radix dark surface.
      expect(content?.classList.contains("bg-foreground")).toBe(false);
    },
  );

  it.each(controls)(
    "$label: the badge is decorative — the control's own aria-label is the single coming-soon source (no double-announce)",
    async ({ node, testid }) => {
      render(node);
      const control = screen.getByTestId(testid);
      fireEvent.focus(control);
      await screen.findByRole("tooltip");
      // Persistent accessible name carries the coming-soon state (browse mode).
      expect(control).toHaveAccessibleName(/coming soon/i);
      // Radix's auto description is blanked, so SR users do not hear it twice.
      expect(control).toHaveAccessibleDescription("");
    },
  );
});

describe("every tooltip control uses the shared Radix wrapper (source scan)", () => {
  // Holidays-only scope: the five button controls now compose the shared
  // ComingSoonIconButton/ComingSoonControl primitive (verified by its unit test
  // below), so they can no longer drift. Holidays keeps its own inert-span
  // composition (nested-button HTML validity), so it stays a source scan.
  const componentsRoot = path.dirname(fileURLToPath(import.meta.url));
  const TOOLTIP_CONTROL_FILES = ["../../features/admin/ui/settings-tab.tsx"];

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
      path.join(componentsRoot, "../../features/admin/ui/settings-tab.tsx"),
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
  // Holidays-only scope: the five button controls inherit the no-native-title
  // guarantee from the shared primitive (verified by its unit test below).
  const componentsRoot = path.dirname(fileURLToPath(import.meta.url));
  const INERT_CONTROL_FILES = ["../../features/admin/ui/settings-tab.tsx"];

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
    "../../../../..",
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
